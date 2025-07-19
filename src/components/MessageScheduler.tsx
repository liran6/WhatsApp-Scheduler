import { useState } from "react";
import { Calendar, Clock, Phone, MessageCircle, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ScheduledMessage {
  id: string;
  phoneNumber: string;
  message: string;
  scheduledDate: Date;
  status: 'pending' | 'sent' | 'failed';
}

export const MessageScheduler = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);

  const handleScheduleMessage = () => {
    if (!phoneNumber || !message || !scheduledDate || !scheduledTime) return;

    const newMessage: ScheduledMessage = {
      id: Date.now().toString(),
      phoneNumber,
      message,
      scheduledDate: new Date(`${scheduledDate}T${scheduledTime}`),
      status: 'pending'
    };

    setScheduledMessages([...scheduledMessages, newMessage]);
    
    // Reset form
    setPhoneNumber("");
    setMessage("");
    setScheduledDate("");
    setScheduledTime("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gradient-primary text-primary-foreground';
      case 'sent': return 'bg-whatsapp text-white';
      case 'failed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 animate-slide-up">
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          WhatsApp Scheduler
        </h1>
        <p className="text-muted-foreground">Schedule your messages to be sent automatically</p>
      </div>

      {/* Compose Message Card */}
      <Card className="shadow-card animate-slide-up bg-gradient-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-whatsapp" />
            Compose Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4 text-whatsapp" />
              Phone Number
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="+1 234 567 8900"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Message</label>
            <Textarea
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px] resize-none"
            />
            <div className="text-right text-sm text-muted-foreground">
              {message.length}/1000
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-whatsapp" />
                Date
              </label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-whatsapp" />
                Time
              </label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Schedule Button */}
          <Button 
            onClick={handleScheduleMessage}
            className="w-full bg-gradient-primary hover:bg-whatsapp-dark shadow-button"
            disabled={!phoneNumber || !message || !scheduledDate || !scheduledTime}
          >
            <Send className="h-4 w-4 mr-2" />
            Schedule Message
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Messages */}
      {scheduledMessages.length > 0 && (
        <Card className="shadow-card animate-slide-up">
          <CardHeader>
            <CardTitle>Scheduled Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {scheduledMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 border rounded-lg bg-gradient-card hover:shadow-message transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium">{msg.phoneNumber}</div>
                    <Badge className={getStatusColor(msg.status)}>
                      {msg.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {msg.message}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {format(msg.scheduledDate, "MMM dd, yyyy 'at' HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};