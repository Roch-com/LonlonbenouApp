import { useState, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ecran, EnTeteApp } from '@/components/ui';
import { colors } from '@/design/theme';
import { useMoi, useSession } from '@/features/reglages/stores/sessionStore';
import { useNotifications } from '@/features/reglages/stores/notificationsStore';
import { BandeauReveil } from './BandeauReveil';
import { MenuPrincipal } from './MenuPrincipal';

interface Props {
  /** Nom de la section, en surtitre. Le titre est le nom de l'espace du couple. */
  section: string;
  children: ReactNode;
  /** Un écran conversationnel gère son propre défilement. */
  defilable?: boolean;
  onRafraichir?: () => void;
  rafraichissement?: boolean;
}

/**
 * Cadre des cinq écrans d'onglet : barre haute, menu, fond, défilement.
 *
 * Réunir les quatre ici plutôt que dans chaque écran garantit qu'ils ne
 * divergent pas — c'est précisément ce qui s'était produit, chaque écran
 * gérant ses marges à sa façon et aucun ne prévoyant la barre d'onglets.
 */
export function EcranOnglet({
  section,
  children,
  defilable = true,
  onRafraichir,
  rafraichissement,
}: Props) {
  const router = useRouter();
  const moi = useMoi();
  const nomEspace = useSession((e) => e.nomEspace);
  const [menuOuvert, setMenuOuvert] = useState(false);

  const journal = useNotifications((e) => e.journal);
  const nonLues = journal.filter(
    (n) => n.destinataireId === moi.id && !n.lueLe,
  ).length;

  return (
    <View style={styles.cadre}>
      <EnTeteApp
        titre={nomEspace}
        surtitre={section}
        actions={[
          {
            icone: 'bell',
            libelle: 'Notifications',
            pastille: nonLues > 0 ? nonLues : undefined,
            onPress: () => router.push('/nous'),
          },
          {
            icone: 'menu',
            libelle: 'Menu',
            onPress: () => setMenuOuvert(true),
          },
        ]}
      />

      <BandeauReveil />

      <Ecran
        dansOnglets
        sousEnTete
        defilable={defilable}
        {...(onRafraichir ? { onRafraichir } : {})}
        {...(rafraichissement !== undefined ? { rafraichissement } : {})}
      >
        {children}
      </Ecran>

      <MenuPrincipal visible={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { flex: 1, backgroundColor: colors.fond },
});
