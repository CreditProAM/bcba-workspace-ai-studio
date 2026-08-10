import { seedDevPersonas } from './seedDev.js';

seedDevPersonas()
  .then((r) => {
    console.log('Seed complete:', JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
