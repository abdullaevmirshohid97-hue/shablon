import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MobileModule } from '../lib/data/modules';

/** Sentinel for "all clients" (no module filter). */
export const ALL_MODULES = '__all__';

/**
 * Left slide-in drawer mirroring the web sidebar: switch between business
 * modules (each filters the client list) plus a sign-out at the bottom.
 * Built on React Native's Animated + Modal so it needs no extra native
 * navigation dependencies (works in Expo Go).
 */
export function Sidebar({
  visible,
  onClose,
  modules,
  selected,
  onSelect,
  orgName,
  userEmail,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  modules: MobileModule[];
  selected: string;
  onSelect: (moduleName: string) => void;
  orgName: string | null;
  userEmail: string;
  onSignOut: () => void;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelWidth = Math.min(300, width * 0.82);
  const translateX = useRef(new Animated.Value(-panelWidth)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -panelWidth,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, panelWidth, translateX]);

  function pick(moduleName: string) {
    onSelect(moduleName);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.panel,
          { width: panelWidth, paddingTop: insets.top + 16, transform: [{ translateX }] },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.brand}>Mubosher</Text>
        </View>

        <ScrollView style={styles.nav} contentContainerStyle={{ paddingBottom: 12 }}>
          <SidebarItem
            label="Barcha mijozlar"
            active={selected === ALL_MODULES}
            onPress={() => pick(ALL_MODULES)}
          />

          {modules.length > 0 && <Text style={styles.section}>MODULLAR</Text>}
          {modules.map((m) => (
            <SidebarItem
              key={m.id}
              label={m.name}
              active={selected === m.name}
              onPress={() => pick(m.name)}
            />
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {orgName ? <Text style={styles.orgName}>{orgName}</Text> : null}
          <Text style={styles.email} numberOfLines={1}>
            {userEmail}
          </Text>
          <Pressable style={styles.signOut} onPress={onSignOut}>
            <Text style={styles.signOutText}>Chiqish</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

function SidebarItem({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.item, active && styles.itemActive]} onPress={onPress}>
      <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    shadowColor: '#18181B',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontWeight: '800' },
  brand: { fontSize: 17, fontWeight: '700', color: '#18181B' },
  nav: { flex: 1 },
  section: {
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 10,
    fontSize: 11,
    fontWeight: '700',
    color: '#A1A1A8',
  },
  item: { paddingVertical: 11, paddingHorizontal: 10, borderRadius: 9 },
  itemActive: { backgroundColor: '#F4F4F5' },
  itemText: { fontSize: 15, color: '#3F3F46', fontWeight: '500' },
  itemTextActive: { color: '#3F3F46', fontWeight: '700' },
  footer: { borderTopWidth: 1, borderTopColor: '#E9E9EB', paddingTop: 12, paddingHorizontal: 6 },
  orgName: { fontSize: 12, fontWeight: '700', color: '#3F3F46' },
  email: { fontSize: 12, color: '#A1A1A8', marginTop: 1 },
  signOut: { marginTop: 10, paddingVertical: 8 },
  signOutText: { color: '#A33A3A', fontWeight: '600' },
});
