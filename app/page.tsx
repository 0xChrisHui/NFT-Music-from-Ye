import Island from '@/src/components/archipelago/Island';
import LoginButton from '@/src/components/auth/LoginButton';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-10 bg-black">
      <div className="absolute right-6 top-6">
        <LoginButton />
      </div>
      <Island />
      <h1 className="text-sm font-light tracking-widest text-white">
        Ripples in the Pond
      </h1>
    </main>
  );
}
