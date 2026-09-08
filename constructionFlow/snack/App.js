import React, { useEffect } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import ConstructionFlowScreen from "./ConstructionFlowScreen";

// Minimal error boundary so a crash shows a recoverable screen instead of a blank one —
// mirrors the production app's AppErrorBoundary (src/app/index.tsx) without any deps Snack
// doesn't need.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { crashed: true, errorMessage: error?.message || "Unknown error" };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ConstructionFlow crashed:", error, errorInfo);
  }

  resetApp = () => {
    this.setState({ crashed: false, errorMessage: "" });
  };

  render() {
    if (this.state.crashed) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#071224", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 420, backgroundColor: "#0d1b33", borderColor: "#233455", borderWidth: 1, borderRadius: 24, padding: 22, alignItems: "center" }}>
            <Text style={{ fontSize: 42, marginBottom: 14 }}>⚠️</Text>
            <Text style={{ color: "#f8fafc", fontSize: 23, fontWeight: "900", textAlign: "center", marginBottom: 10 }}>
              ConstructionFlow hit a bump
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 14 }}>
              The app caught an unexpected error instead of closing.
            </Text>
            <Text style={{ color: "#fca5a5", fontSize: 12, marginBottom: 18 }}>{this.state.errorMessage}</Text>
            <TouchableOpacity
              onPress={this.resetApp}
              style={{ backgroundColor: "#22c55e", paddingHorizontal: 30, paddingVertical: 15, borderRadius: 14, minWidth: 150, alignItems: "center" }}
            >
              <Text style={{ color: "#071224", fontWeight: "900", fontSize: 15 }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  if (!fontsLoaded) return null;

  return (
    <AppErrorBoundary>
      <ConstructionFlowScreen />
    </AppErrorBoundary>
  );
}
