# MÖRE Maskiner – första appversionen

## Innehåll
- Inloggning via Supabase Auth
- Maskinöversikt från `public.machines`
- Sökning och statusfilter
- Skapa maskin
- Visa maskindetaljer och uppdatera status
- MÖRE-profil: mörk bakgrund, vit text, röda accenter

## Starta lokalt
1. Installera Node.js.
2. Packa upp projektet.
3. Kör `npm install`.
4. Kopiera `.env.example` till `.env` och fyll i:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (eller Supabase publishable key)
5. Kör `npm run dev`.

**Viktigt:** Använd aldrig `service_role`-nyckeln i frontend. Databasåtkomst skyddas av Supabase RLS.

## Viktigt inför nästa utvecklingssteg
Den här första frontendversionen använder den befintliga `machines`-tabellen och dess statusvärden `in_stock`, `reserved`, `sold`.
Reservationsformulär, kommentarer, historikvy, profil/rollhantering och säkrare statusflöde ska kopplas in efter verifiering av databaspolicies och triggerlogik.
