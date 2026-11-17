import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-lg border border-gold/40 p-8"
      >
        <h1 className="text-center text-xl font-semibold tracking-widest text-plum">
          LUNAVIVA ADMIN
        </h1>
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          autoFocus
          className="w-full rounded border border-plum/20 px-3 py-2 text-sm text-plum outline-none focus:border-gold"
        />
        {error && (
          <p className="text-sm text-red-700">
            {error === "2"
              ? "Too many attempts. Please wait 15 minutes."
              : "Incorrect password. Try again."}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded bg-plum px-4 py-2 text-sm font-medium text-gold"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
