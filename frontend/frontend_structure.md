frontend/
├── app/
│   ├── (auth)/             # Conceptual (currently in root)
│   ├── admin/              # [NEW] Admin routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── analysis/
│   ├── dashboard/
│   ├── login/
│   ├── signup/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/
│   ├── providers/          # [NEW] AuthProvider
│   └── ui/                 # Shadcn components
├── hooks/
├── lib/
│   ├── auth.ts             # [NEW] Auth utility
│   └── utils.ts
├── store/
│   ├── authStore.ts        # [NEW] Zustand auth store
│   └── useStore.ts         # Existing app store
├── utils/
│   └── supabase/           # Supabase client/server/middleware
└── proxy.ts                # [NEW] Root proxy (Security layer)
