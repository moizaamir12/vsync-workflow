import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import {
  loginWithEmail,
  loginWithGoogle,
  loginWithMicrosoft,
} from "../../src/services/auth";

/** Email + OAuth login screen. */
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = useCallback(async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await loginWithEmail(email, password);
    setLoading(false);

    if (res.error) {
      setError(res.error.message);
    } else {
      router.replace("/(tabs)");
    }
  }, [email, password]);

  const handleGoogleLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await loginWithGoogle();
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
    } else {
      router.replace("/(tabs)");
    }
  }, []);

  const handleMicrosoftLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await loginWithMicrosoft();
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
    } else {
      router.replace("/(tabs)");
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>V Sync</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleEmailLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.oauthButton} onPress={handleGoogleLogin}>
          <Text style={styles.oauthText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.oauthButton} onPress={handleMicrosoftLogin}>
          <Text style={styles.oauthText}>Continue with Microsoft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 32, fontWeight: "800", color: "#6366f1", textAlign: "center" },
  subtitle: { fontSize: 16, color: "#94a3b8", textAlign: "center", marginTop: 8, marginBottom: 32 },
  error: { color: "#ef4444", textAlign: "center", marginBottom: 16, fontSize: 14 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f8fafc",
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#334155" },
  dividerText: { color: "#64748b", marginHorizontal: 12, fontSize: 13 },
  oauthButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  oauthText: { color: "#e2e8f0", fontSize: 15, fontWeight: "500" },
  linkButton: { marginTop: 16, alignItems: "center" },
  linkText: { color: "#94a3b8", fontSize: 14 },
  linkBold: { color: "#6366f1", fontWeight: "600" },
});
