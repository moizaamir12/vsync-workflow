import { Stack } from "expo-router";

/** Workflow stack: list → run → detail. */
export default function WorkflowsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Workflows" }} />
      <Stack.Screen name="[id]" options={{ title: "Run Workflow" }} />
    </Stack>
  );
}
