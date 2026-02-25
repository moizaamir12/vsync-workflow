import { Stack } from "expo-router";

/** Runs stack: history → detail. */
export default function RunsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Runs" }} />
      <Stack.Screen name="[id]" options={{ title: "Run Detail" }} />
    </Stack>
  );
}
