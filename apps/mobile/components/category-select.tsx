import { COLOR } from "@/constants/tokens";
import { Category } from "@/types/entities";
import { Feather } from "@expo/vector-icons";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import ThemedInput from "./ui/themed-Input";
import ThemedText from "./ui/themed-text";

export interface CategorySelectHandle {
  dismissIfOutside: (x: number, y: number) => void;
}

const CategorySelect = forwardRef<CategorySelectHandle, {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
}>(function CategorySelect({ categories, value, onChange }, ref) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<View>(null);
  useImperativeHandle(ref, () => ({
    dismissIfOutside(x, y) {
      if (!open) return;
      containerRef.current?.measureInWindow((left, top, width, height) => {
        if (x < left || x > left + width || y < top || y > top + height) {
          setOpen(false);
          setSearch("");
        }
      });
    },
  }), [open]);
  const selected = categories.find((category) => category.id === value);
  const filtered = categories.filter((category) =>
    category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
    Keyboard.dismiss();
  };

  return (
    <View ref={containerRef} collapsable={false} style={styles.container}>
      {open && (
        <View style={styles.menu}>
          <ThemedInput accessibilityLabel="Search categories" placeholder="Search categories"
            autoFocus value={search} onChangeText={setSearch} style={styles.search}
            returnKeyType="done" onSubmitEditing={() => filtered[0] && choose(filtered[0].id)}
            onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === "Escape") setOpen(false); }} />
          <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {filtered.map((category) => (
              <Pressable key={category.id} accessibilityRole="button"
                accessibilityLabel={`Select ${category.name}`}
                accessibilityState={{ selected: category.id === value }} onPress={() => choose(category.id)}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                <View style={[styles.dot, { backgroundColor: category.color }]} />
                <ThemedText numberOfLines={1} style={styles.name}>{category.name}</ThemedText>
                {category.id === value && <Feather name="check" size={18} color={COLOR.text} />}
              </Pressable>
            ))}
            {filtered.length === 0 && <ThemedText style={styles.empty}>No categories found.</ThemedText>}
          </ScrollView>
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={`Category: ${selected?.name ?? "Select category"}`}
        accessibilityState={{ expanded: open, disabled: categories.length === 0 }} disabled={categories.length === 0}
        onPress={() => { Keyboard.dismiss(); setSearch(""); setOpen((previous) => !previous); }}
        style={({ pressed }) => [styles.trigger, open && styles.active, pressed && styles.pressed]}>
        {selected && <View style={[styles.dot, { backgroundColor: selected.color }]} />}
        <ThemedText numberOfLines={1} style={[styles.name, !selected && styles.placeholder]}>
          {selected?.name ?? "Select category"}
        </ThemedText>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={COLOR.muted} />
      </Pressable>
    </View>
  );
});

export default CategorySelect;

const styles = StyleSheet.create({
  container: { gap: 8 },
  trigger: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLOR.border, borderRadius: 10, backgroundColor: COLOR.bg },
  active: { borderColor: COLOR.muted },
  menu: { backgroundColor: COLOR.elevated, borderWidth: 1, borderColor: COLOR.border, borderRadius: 12, padding: 6, gap: 4 },
  search: { minHeight: 48, backgroundColor: COLOR.surface, color: COLOR.text, borderWidth: 1,
    borderColor: COLOR.muted, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 },
  options: { maxHeight: 192 },
  option: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, borderRadius: 6 },
  name: { flex: 1, fontSize: 15 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  placeholder: { color: COLOR.muted },
  empty: { padding: 12, fontSize: 14, color: COLOR.muted },
  pressed: { opacity: 0.6 },
});
