import "./global.css"
import React from "react";
import { Text, View, TextInput, TouchableOpacity, ScrollView, Platform, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function FlashJob() {
  const router = useRouter();
  const customFont = { fontFamily: 'Itim_400Regular' };
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <SafeAreaView className="flex-1 bg-[#FFFBD4]">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        
        <View className="flex-col md:flex-row items-center justify-between px-4 md:px-12 py-4 md:py-6">
         
          <View className="items-center md:items-start mb-4 md:mb-0">
            <TouchableOpacity activeOpacity={0.7}>
              <Image 
                source={require("../assets/images/LogoFlashJob.png")} 
                style={{ width: isMobile ? 140 : 180, height: isMobile ? 80 : 120 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

         
          <View className="w-full md:flex-1 md:max-w-xl md:mx-16 mb-4 md:mb-0">
            <View className="bg-white rounded-full px-5 py-2 md:py-3 shadow-md border border-gray-100 flex-row items-center">
              <Ionicons name="search" size={18} color="#999" />
              <View className="ml-2 flex-1">
                <TextInput 
                  placeholder="ค้นหางาน..." 
                  style={customFont}
                  className="text-base md:text-lg text-gray-700 outline-none"
                />
              </View>
            </View>
          </View>

          <View className="flex-row items-center justify-center w-full md:w-auto">
            <TouchableOpacity className="mr-6 md:mr-10">
              <Text className="text-xl md:text-2xl text-black tracking-tight" style={[customFont, { fontWeight: 'bold' }]}>Jobboard</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => router.push('./screen/login')}
              className="bg-[#FFD54F] px-6 md:px-10 py-2 md:py-3 rounded-full shadow-lg"
            >
              <Text className="text-lg md:text-xl text-[#424242]" style={[customFont, { fontWeight: 'bold' }]}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

       
        <View className="mx-4 md:mx-12 my-4">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="rounded-[25px] md:rounded-[30px] bg-[#EE3124] py-3 md:py-5 px-4 md:px-10 shadow-xl border-b-4 border-[#C62828]"
            contentContainerStyle={{ 
              flexGrow: 1, 
              minWidth: '100%',
              justifyContent: width > 1024 ? 'space-around' : 'center', 
              alignItems: 'center' 
            }}
          >
            {['งานยอดนิยม', 'โปรแกรมเมอร์\nและเทคโนโลยี', 'ออกแบบกราฟิก', 'รับจ้างทั่วไป', 'การตลาด', 'เขียนและแปลภาษา'].map((item, index) => (
              <TouchableOpacity key={index} className="px-4 py-1 items-center justify-center">
                <Text className="text-white text-sm md:text-base lg:text-lg text-center" style={[customFont, { fontWeight: 'bold' }]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

       
        <View className="items-center mt-10 md:mt-16 px-4 md:px-12">
          <View 
            className="w-full max-w-5xl bg-white/80 rounded-[35px] md:rounded-[50px] p-1 shadow-2xl border border-white/50"
            style={{ elevation: 25 }}
          >
            <View className="bg-[#F8F9FA] rounded-[33px] md:rounded-[48px] px-6 md:px-12 py-8 md:py-16 flex-row items-center">
              <Ionicons 
                name="sparkles" 
                size={isMobile ? 24 : 40} 
                color="#FBC02D" 
                style={{ marginRight: isMobile ? 12 : 24 }} 
              />
              <TextInput 
                placeholder="ถาม AI เพื่อหางานที่เหมาะกับคุณ..." 
                style={[customFont, { fontWeight: 'bold' }]}
                className="flex-1 text-xl md:text-3xl lg:text-4xl text-gray-600 outline-none"
                placeholderTextColor="#BBB"
                multiline={false}
              />
              <TouchableOpacity className="bg-black p-3 md:p-5 rounded-full shadow-xl ml-2 md:ml-4">
                <Ionicons name="arrow-forward" size={isMobile ? 20 : 32} color="white" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text className="mt-6 md:mt-8 text-gray-500 text-sm md:text-lg italic text-center" style={customFont}>
            "หางานฟรีแลนซ์ต่างๆ" หรือ "หางานกราฟิกแบบ Work from Home"
          </Text>
        </View>

        
        <View className="mt-auto px-6 md:px-12 py-8 md:py-10 flex-col md:flex-row justify-between items-center">
          <TouchableOpacity className="mb-4 md:mb-0">
            <Text className="text-gray-800 text-lg md:text-xl border-b-2 border-black" style={[customFont, { fontWeight: 'bold' }]}>
              เกี่ยวกับเรา
            </Text>
          </TouchableOpacity>
          <Text className="text-gray-400 text-xs md:text-base" style={customFont}>© 2026 FlashJob. All rights reserved.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}