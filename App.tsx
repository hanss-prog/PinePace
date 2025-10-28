// App.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types";

import StartScreen from "./StartScreen";
import TermsScreen from "./TermsScreen";
import MapScreen from "./MapScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Start">
        <Stack.Screen name="Start" component={StartScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="MapScreen" component={MapScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";

async function testFirestore() {
  try {
    const querySnapshot = await getDocs(collection(db, "testCollection"));
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${JSON.stringify(doc.data())}`);
    });
    console.log("✅ Firestore connection successful!");
  } catch (e) {
    console.error("❌ Firestore test failed:", e);
  }
}

testFirestore();
