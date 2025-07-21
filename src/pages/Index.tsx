import { MessageScheduler } from "@/components/MessageScheduler";
import { AuthForm } from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { isAuthenticated, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={() => window.location.reload()} />;
  }

  return <MessageScheduler onSignOut={signOut} />;
};

export default Index;
