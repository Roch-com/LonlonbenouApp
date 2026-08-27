/**
 * Vérifie que le suivi d'erreurs reste inerte sans DSN, et s'active avec.
 *
 * La propriété qui compte est la première : le câblage est livré avant que le
 * compte Sentry n'existe, et il ne doit ni ralentir le démarrage ni accumuler
 * des événements sans destination.
 */
import { demarrerLaSurveillance } from '../src/surveillance.ts';

delete process.env['SENTRY_DSN'];
const sansDsn = demarrerLaSurveillance();
console.log(`sans DSN : ${sansDsn ? '❌ actif' : '✅ inactif'}`);

process.env['SENTRY_DSN'] = 'https://exemple@o0.ingest.sentry.io/0';
const avecDsn = demarrerLaSurveillance();
console.log(`avec DSN : ${avecDsn ? '✅ actif' : '❌ inactif'}`);

process.exit(!sansDsn && avecDsn ? 0 : 1);
