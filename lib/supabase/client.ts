// Dummy supabase client for compatibility
export function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { email: 'admin@example.com' } }, error: null }),
      signOut: async () => {},
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: () => ({}) }) }),
      insert: () => ({ select: () => ({}) }),
    }),
  }
}

// Dummy createBrowserClient
export function createBrowserClient() {
  return createClient()
}