import type { ComponentType } from 'react';
import { BarriereErreur } from './BarriereErreur';

/**
 * Pose une {@link BarriereErreur} autour d'un écran de route.
 *
 * La barrière est mise ici, et non dans les composants de mise en page :
 * quand un écran lève pendant son rendu, l'exception vient de l'écran
 * lui-même, donc d'au-dessus de tout ce qu'il retourne. Une barrière placée
 * à l'intérieur ne la verrait jamais passer.
 *
 * Une barrière par route plutôt qu'une seule à la racine : ainsi la barre
 * d'onglets et les autres écrans continuent de fonctionner, ce qui laisse de
 * quoi aller supprimer la donnée qui fait échouer celui-là.
 */
export function ecranProtege<P extends object>(
  Ecran: ComponentType<P>,
  zone: string,
): ComponentType<P> {
  function EcranProtege(props: P) {
    return (
      <BarriereErreur zone={zone}>
        <Ecran {...props} />
      </BarriereErreur>
    );
  }
  EcranProtege.displayName = `Protege(${zone})`;
  return EcranProtege;
}
