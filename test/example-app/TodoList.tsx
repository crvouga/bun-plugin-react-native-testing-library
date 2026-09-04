import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

export type TodoListProps = {
  initial?: string[];
};

export function TodoList({ initial = [] }: TodoListProps) {
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setItems((prev) => [...prev, t]);
    setDraft("");
  };

  const remove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <View testID="todo-root">
      <Text testID="todo-count">{items.length}</Text>
      <TextInput
        testID="todo-input"
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a todo"
        accessibilityLabel="todo input"
      />
      <Pressable
        testID="todo-add"
        accessibilityRole="button"
        accessibilityLabel="add todo"
        onPress={add}
      >
        <Text>Add</Text>
      </Pressable>
      <FlatList
        testID="todo-list"
        data={items}
        keyExtractor={(item, index) => `${index}-${item}`}
        renderItem={({ item, index }) => (
          <Pressable
            testID={`todo-item-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`remove ${item}`}
            onPress={() => remove(index)}
          >
            <Text testID={`todo-text-${index}`}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
