import { useState } from 'react';
import { EnTete, Segments } from '@/components/ui';
import { EcranOnglet } from '@/components/chrome/EcranOnglet';
import { useAutre } from '@/features/reglages/stores/sessionStore';
import { SectionAxes } from '../components/SectionAxes';
import { SectionConfidences } from '../components/SectionConfidences';
import { SectionScore } from '../components/SectionScore';

type Onglet = 'axes' | 'confidences' | 'elan';

/** Pôle ② — Communication profonde & croissance (P0). */
export function CroissanceEcran() {
  const autre = useAutre();
  const [onglet, setOnglet] = useState<Onglet>('axes');

  return (
    <EcranOnglet section="Croissance">
      <EnTete
        surtitre="Croissance"
        titre="Se dire les choses"
        sousTitre={SOUS_TITRES[onglet](autre.prenom)}
      />

      <Segments
        etiquette="Sections de la croissance"
        segments={SEGMENTS}
        actif={onglet}
        onChanger={setOnglet}
      />

      {onglet === 'axes' ? <SectionAxes /> : null}
      {onglet === 'confidences' ? <SectionConfidences /> : null}
      {onglet === 'elan' ? <SectionScore /> : null}
    </EcranOnglet>
  );
}

const SEGMENTS = [
  { cle: 'axes', libelle: 'Axes' },
  { cle: 'confidences', libelle: 'Confidences' },
  { cle: 'elan', libelle: 'Notre élan' },
] as const satisfies readonly { cle: Onglet; libelle: string }[];

const SOUS_TITRES: Record<Onglet, (prenomAutre: string) => string> = {
  axes: (autre) => `Ce que vous décidez de regarder avec ${autre}.`,
  confidences: (autre) => `Ce que vous choisissez d’offrir à ${autre}.`,
  elan: () => 'Vos gestes récents, à deux. Jamais une note de l’un ou de l’autre.',
};
