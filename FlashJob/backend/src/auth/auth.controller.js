const authService = require("./auth.service");

// ── Cookie Config ────────────────────────────────────────────────────────────

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,           // JS เข้าถึงไม่ได้ ป้องกัน XSS
  secure: process.env.NODE_ENV === "production", // HTTPS only ใน production
  sameSite: "strict",       // ป้องกัน CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 วัน (ms)
  path: "/api/v1/auth",     // จำกัด cookie ไว้แค่ path auth
};

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * ครอบ async handler เพื่อดัก error ส่งไปยัง next()
 */
const catchAsync = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * สมัครสมาชิกใหม่
 */
const register = catchAsync(async (req, res) => {
  const user = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: "สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลของคุณ",
    data: { user },
  });
});

/**
 * POST /api/v1/auth/login
 * เข้าสู่ระบบ
 */
const login = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);

  // เก็บ refresh token ใน HttpOnly cookie (ปลอดภัยกว่าส่งใน body)
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "เข้าสู่ระบบสำเร็จ",
    data: { user, accessToken },
  });
});

/**
 * POST /api/v1/auth/refresh-token
 * ขอ access token ใหม่ด้วย refresh token
 */
const refreshToken = catchAsync(async (req, res) => {
  // รับ refresh token จาก cookie (หรือ body เป็น fallback สำหรับ mobile)
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "ไม่พบ Refresh token",
    });
  }

  const { accessToken, refreshToken: newRefreshToken } =
    await authService.refreshToken(token);

  // ออก cookie ใหม่พร้อม rotated token
  res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "ต่ออายุ token สำเร็จ",
    data: { accessToken },
  });
});

/**
 * POST /api/v1/auth/logout
 * ออกจากระบบ
 */
const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
  await authService.logout(token);

  // ลบ cookie
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });

  res.status(200).json({
    success: true,
    message: "ออกจากระบบสำเร็จ",
  });
});

/**
 * GET /api/v1/auth/verify-email?token=xxx
 * ยืนยันอีเมล
 */
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "ไม่พบ token ยืนยันอีเมล",
    });
  }

  await authService.verifyEmail(token);

  res.status(200).json({
    success: true,
    message: "ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบ",
  });
});

/**
 * POST /api/v1/auth/forgot-password
 * ส่ง link รีเซ็ตรหัสผ่านไปยังอีเมล
 */
const forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);

  // Response เดิมไม่ว่าอีเมลจะมีอยู่หรือไม่ (ป้องกัน email enumeration)
  res.status(200).json({
    success: true,
    message: "หากอีเมลนี้ถูกลงทะเบียนไว้ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านในไม่ช้า",
  });
});

/**
 * POST /api/v1/auth/reset-password
 * รีเซ็ตรหัสผ่านด้วย token
 */
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.body);

  res.status(200).json({
    success: true,
    message: "รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่",
  });
});

/**
 * PATCH /api/v1/auth/change-password
 * เปลี่ยนรหัสผ่าน (ต้องล็อกอินอยู่)
 */
const changePassword = catchAsync(async (req, res) => {
  await authService.changePassword({
    userId: req.user.id, // มาจาก auth middleware
    ...req.body,
  });

  // เพิกถอน session เก่าทั้งหมด → บังคับ login ใหม่
  res.clearCookie("refreshToken", { path: "/api/v1/auth" });

  res.status(200).json({
    success: true,
    message: "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่",
  });
});

/**
 * GET /api/v1/auth/me
 * ดูข้อมูลผู้ใช้ปัจจุบัน (ต้องล็อกอินอยู่)
 */
const getMe = catchAsync(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * GET /api/v1/auth/google
 * เริ่ม OAuth flow กับ Google (ใช้ร่วมกับ Passport.js)
 * Passport จะ redirect ไป Google ให้อัตโนมัติ
 */
const googleAuth = (req, res) => {
  // handler จริงอยู่ใน passport.authenticate('google') middleware
  // ไฟล์นี้ใช้เป็น placeholder สำหรับ route definition
};

/**
 * GET /api/v1/auth/google/callback
 * Google OAuth callback — Passport วาง user ไว้ใน req.user
 */
const googleCallback = catchAsync(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.oauthLogin({
    provider: "google",
    providerId: req.user.id,
    email: req.user.email,
    firstName: req.user.given_name,
    lastName: req.user.family_name,
    avatar: req.user.picture,
  });

  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTIONS);

  // Redirect กลับไปหน้า frontend พร้อม access token (หรือใช้ state parameter)
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`
  );
});

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  googleAuth,
  googleCallback,
};