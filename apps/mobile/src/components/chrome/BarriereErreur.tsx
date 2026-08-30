import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import type { Theme } from '@lonlonbenu/shared';
import { Bouton, Carte, Texte } from '@/components/ui';
import { stylesDynamiques } from '@/design/stylesDynamiques';
import { espacements } from '@/design/theme';

interface Props {
  /** Nom de la zone protégée, affiché et joint au rapport. */
  zone: string;
  children: ReactNode;
}

interface Etat {
  erreur?: Error;
}

/**
 * Filet sous le rendu.
 *
 * Sans barrière, une exception levée pendant le rendu démonte tout l'arbre
 * React et l'application se ferme. Vu du téléphone, elle « sort toute seule »,
 * sans un mot — et le défaut se rejoue à chaque ouverture quand il tient à une
 * donnée déjà enregistrée. C'est précisément ce qui est arrivé au pôle ③ : un
 * horodatage illisible rendait le module inaccessible pour de bon.
 *
 * La barrière ne répare rien. Elle transforme une fermeture muette en un écran
 * qui dit ce qui s'est passé et laisse le reste de l'application utilisable —
 * ce qui suffit, la plupart du temps, à contourner et à supprimer la donnée
 * fautive.
 *
 * Le message d'erreur technique est affiché volontairement : sans suivi
 * configuré, c'est la seule trace qui puisse remonter jusqu'à quelqu'un
 * capable d'agir. Il reste sous un titre en langage ordinaire, pour ne pas
 * donner l'impression que l'app accuse la personne.
 */
export class BarriereErreur extends Component<Props, Etat> {
  state: Etat = {};

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    Sentry.withScope((portee) => {
      portee.setTag('zone', this.props.zone);
      portee.setContext('react', { pileComposants: infos.componentStack });
      Sentry.captureException(erreur);
    });
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    return (
      <ScrollView contentContainerStyle={styles.cadre}>
        <Carte>
          <Texte variante="titre">Cette partie n’a pas pu s’afficher</Texte>
          <Texte variante="corpsDoux" style={styles.intro}>
            Rien n’est perdu et rien n’a été envoyé de travers. Le reste de
            l’application fonctionne normalement.
          </Texte>

          <View style={styles.details}>
            <Texte variante="meta">{this.props.zone}</Texte>
            <Texte variante="petit" style={styles.technique}>
              {erreur.message || String(erreur)}
            </Texte>
          </View>

          <View style={styles.actions}>
            <Bouton
              libelle="Réessayer"
              onPress={() => this.setState({ erreur: undefined })}
            />
          </View>
        </Carte>
      </ScrollView>
    );
  }
}

const styles = stylesDynamiques(({ colors }: Theme) => ({
  cadre: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espacements.lg,
    backgroundColor: colors.fond,
  },
  intro: { marginTop: espacements.xs },
  details: {
    marginTop: espacements.lg,
    gap: espacements.xxs,
    padding: espacements.md,
    backgroundColor: colors.fondNuance,
    borderRadius: 12,
  },
  technique: { color: colors.texteDoux },
  actions: { marginTop: espacements.lg },
}));
