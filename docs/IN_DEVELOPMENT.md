# In Development Notes

Updated: 2026-02-13

## Tested Flows
- Dashboard load and navigation are responsive in dev mode.
- Clients flow works: quick-create client from appointments wizard creates a real client card.
- QR page opens and renders for valid slug path.

## Issues Found (Mark as "In Development")

### 1) QR booking link can be invalid when business slug is empty
- **Observed:** Logged-in business has empty `slug` (`""`), and `/qr` shows link `http://localhost:3000/booking`.
- **Result:** Opening `/booking` returns 404.
- **Status:** In development.
- **Expected fix:** Enforce non-empty slug on business profile/create flow and block QR generation until slug is valid.

### 2) Public booking wizard can stall on specialist step without guidance
- **Observed:** On `/booking/test-business`, after selecting service, step "Оберіть спеціаліста" is empty and "Далі" stays disabled.
- **Result:** User cannot continue, no explicit empty-state explanation.
- **Status:** In development.
- **Expected fix:** Show explicit message like "Немає доступних спеціалістів. Зверніться до адміністратора" and add CTA/back action.

### 3) Dashboard appointment creation can stall without configured specialists/slots
- **Observed:** In dashboard "Записи -> Записати", client can be created, but appointment form shows no available specialist/slots, and create button is disabled.
- **Result:** Booking cannot be completed from cabinet for current data setup.
- **Status:** In development.
- **Expected fix:** Add clear blocking reason + action hints (create specialist, configure schedule, choose another date).

## Performance Note
- Navigation timing in browser (dev mode): `DOMContentLoaded ~200ms`, `load ~360ms` on tested pages.
- Re-check in production build after deploy, since dev mode timing is not final performance baseline.
