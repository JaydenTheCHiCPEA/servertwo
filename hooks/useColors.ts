import { useContext } from "react";
import { useColorScheme } from "react-native";
import colors from "@/constants/colors";
import { ThemeContext } from "@/context/ThemeContext";

export function useColors() {
  const scheme = useColorScheme();
  const ctx = useContext(ThemeContext);
  const theme = ctx?.theme ?? (scheme === "dark" ? "dark" : "light");
  const palette = theme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
