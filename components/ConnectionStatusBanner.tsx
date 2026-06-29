import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "../constants/Colors";

export function ConnectionStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        İnternet bağlantısı yok. Bazı bilgiler güncellenemeyebilir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    zIndex: 1000,
    borderRadius: 8,
    backgroundColor: "#111827",
    paddingHorizontal: 14,
    paddingVertical: 10,
    boxShadow: "0 6px 12px rgba(0, 0, 0, 0.18)",
    elevation: 8,
  },
  text: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
