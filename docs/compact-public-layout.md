# Compact public website layout

The public website retains Plum Creek's green/cream palette, serif headings and neighborhood imagery, with smaller banners, tighter section spacing and compact cards. Public styles live in `app/public.css`, scoped to `.public-shell`; the private workspace retains its separate theme. The social sharing image remains available for link previews, while the homepage uses a shorter text-and-photo banner with the existing entrance photograph.

The header keeps Home, Dues, Documents, Events, Map, Contact and Member portal readily accessible. More contains leadership, committees, the homes directory and participation/request pages. At widths up to 900px, Menu opens the navigation panel. Current pages are marked, clicking a link closes the menus, Escape closes the menus and returns focus, and clicking outside closes them. A keyboard-accessible skip link goes to the main content. Mobile navigation no longer hides the Documents link.

Measurements from Chromium at a 1366 × 768 viewport, in pixels:

| Area | Before | After |
| --- | ---: | ---: |
| Homepage banner height | 827 | 223 |
| First homepage resource card starts | 1191 | 423 |
| Dues banner height | 600 | 188 |
| Dues summary starts | 782 | 284 |
| Documents banner height | 564 | 166 |
| First document card starts | 1091 | 430 |

At 390 × 844, the public header is 64px rather than 147px, and the first homepage resource card starts at 422px rather than 1031px. Content remains readable and scrollable; compact does not require every page to fit into a single screen.

Verification covers 16 routes at five viewport sizes (1366, 1280, 820, 390 and 320px wide), with no horizontal overflow or JavaScript page errors; menu open/close, Escape, navigation and active links; visual review of desktop/mobile screenshots; production build, lint and existing rendered-page checks. Supabase requests in these browser checks are intercepted to use saved public fallbacks. Password recovery and member/passcode/rental browser regressions passed with synthetic sessions and intercepted API traffic. The visual update changes no database schema, records, account credentials or member authorization rules.
