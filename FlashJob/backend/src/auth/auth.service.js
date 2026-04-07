const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const emailService = require("../shared/services/email.service");

const prisma = new PrismaClient();

const {
  JWT_SECRET,
  JWT_EXPIRES_IN = "15m",
  JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN = "7d",
  BCRYPT_ROUNDS = 12,
  FRONTEND_URL,
} = process.env;

// ── Token Helpers ────────────────────────────────────────────────────────────

/**
 * สร้าง access token อายุสั้น (15 นาที)
 */
const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

/**
 * สร้าง refresh token อายุยาว (7 วัน)
 */
const generateRefreshToken = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

/**
 * สร้าง token สุ่มสำหรับ email verify / reset password
 */
const generateSecureToken = () => crypto.randomBytes(32).toString("hex");

/**
 * Hash token ก่อนเก็บ DB เพื่อความปลอดภัย
 */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// ── Auth Service ─────────────────────────────────────────────────────────────

const authService = {
  /**
   * สมัครสมาชิกใหม่
   */
  async register({ firstName, lastName, email, password, role, phone }) {
    // ตรวจสอบว่าอีเมลซ้ำหรือไม่
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const err = new Error("อีเมลนี้ถูกใช้งานแล้ว");
      err.statusCode = 409;
      throw err;
    }

    // Hash รหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, Number(BCRYPT_ROUNDS));

    // สร้าง email verification token
    const emailToken = generateSecureToken();
    const emailTokenHash = hashToken(emailToken);
    const emailTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ชั่วโมง

    // สร้าง user ใน DB
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role,
        phone,
        emailVerifyToken: emailTokenHash,
        emailVerifyTokenExpiry: emailTokenExpiry,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    // ส่งอีเมลยืนยัน (ไม่ block response)
    emailService
      .sendVerificationEmail({
        to: email,
        name: firstName,
        verifyUrl: `${FRONTEND_URL}/verify-email?token=${emailToken}`,
      })
      .catch((err) => console.error("[Email] ส่งอีเมลยืนยันไม่สำเร็จ:", err));

    return user;
  },

  /**
   * เข้าสู่ระบบ
   * @returns {{ user, accessToken, refreshToken }}
   */
  async login({ email, password, rememberMe }) {
    // ดึง user พร้อม password hash
    const user = await prisma.user.findUnique({ where: { email } });

    // ใช้ timing-safe comparison เพื่อป้องกัน timing attack
    const isPasswordValid = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, "$2a$12$dummyhashfortimingresilience");

    if (!user || !isPasswordValid) {
      const err = new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      err.statusCode = 401;
      throw err;
    }

    if (user.isBanned) {
      const err = new Error("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายสนับสนุน");
      err.statusCode = 403;
      throw err;
    }

    if (!user.isEmailVerified) {
      const err = new Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      err.statusCode = 403;
      err.code = "EMAIL_NOT_VERIFIED";
      throw err;
    }

    const tokenPayload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // บันทึก refresh token hash ลง DB
    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(
          Date.now() +
            (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000 // 30 วัน หรือ 7 วัน
        ),
      },
    });

    // อัปเดต lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { password: _pw, emailVerifyToken: _evt, ...safeUser } = user;

    return { user: safeUser, accessToken, refreshToken };
  },

  /**
   * Refresh access token ด้วย refresh token
   */
  async refreshToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
      const err = new Error("Refresh token ไม่ถูกต้องหรือหมดอายุ");
      err.statusCode = 401;
      throw err;
    }

    const tokenHash = hashToken(token);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
      const err = new Error("Refresh token ไม่ถูกต้องหรือถูกเพิกถอนแล้ว");
      err.statusCode = 401;
      throw err;
    }

    // Rotate refresh token (เพิ่มความปลอดภัย)
    const newRefreshToken = generateRefreshToken({
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
    });

    // เพิกถอน token เก่า + สร้างใหม่ใน transaction
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { tokenHash },
        data: { isRevoked: true },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: hashToken(newRefreshToken),
          userId: storedToken.userId,
          expiresAt: storedToken.expiresAt,
        },
      }),
    ]);

    const newAccessToken = generateAccessToken({
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  /**
   * Logout: เพิกถอน refresh token
   */
  async logout(refreshToken) {
    if (!refreshToken) return;

    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken
      .update({ where: { tokenHash }, data: { isRevoked: true } })
      .catch(() => {}); // ไม่ throw ถ้า token ไม่พบ
  },

  /**
   * ยืนยันอีเมล
   */
  async verifyEmail(token) {
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: tokenHash,
        emailVerifyTokenExpiry: { gt: new Date() },
        isEmailVerified: false,
      },
    });

    if (!user) {
      const err = new Error("Token ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ");
      err.statusCode = 400;
      throw err;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyTokenExpiry: null,
      },
    });
  },

  /**
   * ขอ reset รหัสผ่าน (ส่งอีเมล)
   */
  async forgotPassword(email) {
    const user = await prisma.user.findUnique({ where: { email } });

    // ไม่ reveal ว่าอีเมลมีอยู่หรือไม่ (security best practice)
    if (!user) return;

    const resetToken = generateSecureToken();
    const resetTokenHash = hashToken(resetToken);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: resetTokenHash, resetPasswordTokenExpiry: resetTokenExpiry },
    });

    await emailService.sendPasswordResetEmail({
      to: email,
      name: user.firstName,
      resetUrl: `${FRONTEND_URL}/reset-password?token=${resetToken}`,
    });
  },

  /**
   * Reset รหัสผ่านด้วย token
   */
  async resetPassword({ token, newPassword }) {
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      const err = new Error("Token รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(newPassword, Number(BCRYPT_ROUNDS));

    // อัปเดตรหัสผ่าน + เพิกถอน refresh tokens ทั้งหมด
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordTokenExpiry: null,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      }),
    ]);
  },

  /**
   * เปลี่ยนรหัสผ่าน (ต้องล็อกอินอยู่)
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      const err = new Error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      err.statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(newPassword, Number(BCRYPT_ROUNDS));

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      // เพิกถอน session อื่นๆ ทั้งหมด (ยกเว้น session ปัจจุบันอาจต้องส่ง tokenId มาด้วย)
      prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      }),
    ]);
  },

  /**
   * OAuth Login (Google / Facebook)
   * ถ้ายังไม่มีบัญชี → สร้างใหม่อัตโนมัติ
   */
  async oauthLogin({ provider, providerId, email, firstName, lastName, avatar }) {
    let user = await prisma.user.findFirst({
      where: { OR: [{ [`${provider}Id`]: providerId }, { email }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          avatar,
          isEmailVerified: true,
          [`${provider}Id`]: providerId,
          role: "buyer",
        },
      });
    } else if (!user[`${provider}Id`]) {
      // เชื่อมบัญชี OAuth เข้ากับบัญชีที่มีอยู่
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [`${provider}Id`]: providerId },
      });
    }

    const tokenPayload = { sub: user.id, role: user.role, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        tokenHash: hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _pw, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  },
};

module.exports = authService;