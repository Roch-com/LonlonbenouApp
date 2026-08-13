import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, espacements } from '@/design/theme';

interface Props {
  children: ReactNode;
  /** Un écran conversationnel gère son propre défilement. */
  defilable?: boolean;
}

export function Ecran({ children, defilable = true }: Props) {
  const marges = useSafeAreaInsets();
  const rembourrage = {
    paddingTop: marges.top + espacements.md,
    paddingBottom: espacements.xxl,
  };

  if (!defilable) {
    return (
      <View style={[styles.fond, { paddingTop: marges.top }]}>{children}</View>
    );
  }

  return (
    <ScrollView
      style={styles.fond}
      contentContainerStyle={[styles.contenu, rembourrage]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: colors.fond },
  contenu: {
    paddingHorizontal: espacements.lg,
    gap: espacements.md,
  },
});
