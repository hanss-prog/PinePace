// screens/StartScreen.tsx
import React from "react";
import { View, Text, Button, StyleSheet, Alert, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";

type Props = NativeStackScreenProps<RootStackParamList, "Start">;

export default function StartScreen({ navigation }: Props) {
  const showTerms = () => {
    Alert.alert(
      "Terms and Conditions",
      "By continuing, you agree to the following:\n\n" +
        "1. This app will collect and use your device’s location to provide navigation and road speed information.\n" +
        "2. Location data is only used while the app is running and will not be stored, sold, or shared with third parties.\n" +
        "3. You are responsible for complying with traffic laws while using this app. The speed limits shown are based on available data and may not always reflect real-time conditions.\n" +
        "4. This app is provided 'as-is' without warranties of any kind. Use at your own discretion.\n\n" +
        "Do you accept these terms?",
      [
        {
          text: "Decline",
          style: "cancel",
        },
        {
          text: "Agree on this terms",
          onPress: () => navigation.navigate("MapScreen"),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Baguio Roads App</Text>
      <Button title="View Terms & Continue" onPress={showTerms} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },
});
