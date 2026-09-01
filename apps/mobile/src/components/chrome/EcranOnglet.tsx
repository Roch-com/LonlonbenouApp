import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Theme } from '@lonlonbenu/shared';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { useRouter } from 'expo-router';
import { Ecran, EnTeteApp } from '@/components/ui';

import { useMoi } from '@/features/reglages/stores/sessionStore';
import { useNomEspace } from '@/features/reglages/stores/sessionServeurStore';
import { useNotifications } from '@/features/reglages/stores/notificationsStore';
import { Children, isValidElement } from 'react';
import { Apparition } from './Apparition';
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
  const nomEspace = useNomEspace();
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
        {/* Chaque bloc de premier niveau entre à son tour. La cascade se lit
            comme un écran qui se compose, là où un affichage simultané donne
            l'impression d'un saut. */}
        {Children.toArray(children).map((enfant, rang) =>
          isValidElement(enfant) ? (
            <Apparition key={enfant.key ?? rang} rang={rang}>
              {enfant}
            </Apparition>
          ) : (
            enfant
          ),
        )}
      </Ecran>

      <MenuPrincipal visible={menuOuvert} onFermer={() => setMenuOuvert(false)} />
    </View>
  );
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: { flex: 1, backgroundColor: colors.fond },
}));
