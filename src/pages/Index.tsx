import { MessageScheduler } from "@/components/MessageScheduler";
import heroImage from "@/assets/hero-image.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-20">
          <img 
            src={heroImage} 
            alt="WhatsApp Scheduler" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative container mx-auto px-4 py-16 text-center">
          <div className="animate-float">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Schedule WhatsApp
              <span className="block text-primary-glow">Messages</span>
            </h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
              Never forget to send important messages again. Schedule your WhatsApp messages 
              to be sent at the perfect time.
            </p>
          </div>
        </div>
      </div>

      {/* Main App */}
      <MessageScheduler />
    </div>
  );
};

export default Index;
