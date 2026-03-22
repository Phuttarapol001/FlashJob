import React from "react";
import { Text, View, TextInput, TouchableOpacity, Image, SafeAreaView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function LoginScreen() {
  const router = useRouter();
  const customFont = { fontFamily: 'Itim_400Regular' };
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <SafeAreaView className="flex-1 bg-[#FFFBD4]">
     
      <View className="flex-row justify-between items-start px-8 md:px-12 py-6 md:py-10">
        <Image 
          source={require("../../assets/images/LogoFlashJob.png")} 
          style={{ width: isMobile ? 120 : 160, height: isMobile ? 70 : 100 }}
          resizeMode="contain"
        />
        
       
        <TouchableOpacity 
          onPress={() => router.back()}
          className="bg-[#FFEBB7] p-3 rounded-2xl shadow-sm border border-[#F0D090]"
        >
          <Ionicons name="return-up-back" size={isMobile ? 24 : 32} color="black" />
        </TouchableOpacity>
      </View>

      
      <View className="flex-1 justify-center items-center px-6 pb-20">
        <View 
          className="bg-white w-full max-w-2xl rounded-[50px] p-10 md:p-20 shadow-2xl items-center"
          style={{ elevation: 20 }}
        >
          <Text 
            className="text-4xl md:text-5xl text-black mb-12" 
            style={[customFont, { fontWeight: 'bold' }]}
          >
            LOGIN
          </Text>

         
          <View className="w-full space-y-6">
            <View className="bg-[#E9E4E4] rounded-3xl px-8 py-4 md:py-6 mb-6">
              <TextInput 
                placeholder="Username"
                style={[customFont, { fontSize: 22 }]}
                className="text-gray-700 outline-none"
              />
            </View>

            <View className="bg-[#E9E4E4] rounded-3xl px-8 py-4 md:py-6 mb-10">
              <TextInput 
                placeholder="Password"
                secureTextEntry
                style={[customFont, { fontSize: 22 }]}
                className="text-gray-700 outline-none"
              />
            </View>

           
            <TouchableOpacity 
              className="bg-[#E9E4E4] rounded-3xl py-4 md:py-6 items-center shadow-sm"
              activeOpacity={0.7}
            >
              <Text 
                className="text-2xl md:text-3xl text-black" 
                style={[customFont, { fontWeight: 'bold' }]}
              >
                สร้างบัญชี
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
