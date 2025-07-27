import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, MessageSquare, Clock, Send, LogOut } from 'lucide-react';

interface ScheduledMessage {
  id: string;
  user_id: string;
  phone_number: string;
  message: string;
  scheduled_time: string;
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface MessageSchedulerProps {
  onSignOut: () => void;
}

export const MessageScheduler = ({ onSignOut }: MessageSchedulerProps) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load scheduled messages from Supabase
  const loadMessages = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_time', { ascending: true });

      if (error) throw error;
      
      setScheduledMessages((data || []) as ScheduledMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load scheduled messages",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadMessages();
  }, [user]);

  // Real-time subscription for scheduled messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('scheduled_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Check for due messages every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const dueMessages = scheduledMessages.filter(msg => 
        msg.status === 'pending' && new Date(msg.scheduled_time) <= now
      );

      dueMessages.forEach(msg => {
        openWhatsApp(msg.phone_number, msg.message);
        updateMessageStatus(msg.id, 'sent');
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [scheduledMessages]);

  const openWhatsApp = async (phoneNumber: string, message: string) => {
    const cleanPhoneNumber = phoneNumber.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    
    // Try to open WhatsApp natively first
    try {
      // For native app, use the whatsapp:// scheme
      const whatsappUrl = `whatsapp://send?phone=${cleanPhoneNumber}&text=${encodedMessage}`;
      
      // Check if we're in a native environment
      if ((window as any).Capacitor?.isNativePlatform()) {
        // Use Capacitor's Browser plugin to open URL
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: whatsappUrl });
      } else {
        // Fallback to web URL for browser
        const webUrl = `https://wa.me/${cleanPhoneNumber}?text=${encodedMessage}`;
        window.open(webUrl, '_blank');
      }
      
      toast({
        title: "WhatsApp Opened!",
        description: `Message ready to send to ${phoneNumber}`,
      });
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      toast({
        title: "Error",
        description: "Could not open WhatsApp. Make sure it's installed on your device.",
        variant: "destructive",
      });
    }
  };

  const scheduleMessage = async () => {
    if (!phoneNumber || !message || !scheduledDate || !scheduledTime) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to schedule messages",
        variant: "destructive",
      });
      return;
    }

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    
    if (scheduledDateTime <= new Date()) {
      toast({
        title: "Error",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          user_id: user.id,
          phone_number: phoneNumber,
          message,
          scheduled_time: scheduledDateTime.toISOString(),
          status: 'pending'
        });

      if (error) throw error;

      // Clear form
      setPhoneNumber('');
      setMessage('');
      setScheduledDate('');
      setScheduledTime('');

      toast({
        title: "Success",
        description: "Message scheduled successfully!",
      });
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast({
        title: "Error",
        description: "Failed to schedule message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (id: string, status: 'sent' | 'cancelled') => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const sendNow = (phoneNumber: string, message: string, id: string) => {
    openWhatsApp(phoneNumber, message);
    updateMessageStatus(id, 'sent');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            WhatsApp Message Scheduler
          </h1>
          <p className="text-muted-foreground text-lg">
            Schedule your WhatsApp messages and never forget to send them again
          </p>
        </div>
        <Button
          onClick={onSignOut}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>

      {/* Schedule Message Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Schedule New Message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Enter your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={scheduleMessage} 
            className="w-full"
            size="lg"
            disabled={loading}
          >
            <Clock className="mr-2 h-5 w-5" />
            {loading ? 'Scheduling...' : 'Schedule Message'}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scheduled Messages ({scheduledMessages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scheduledMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled messages yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledMessages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span className="font-medium">{msg.phone_number}</span>
                    </div>
                    <Badge 
                      variant={msg.status === 'pending' ? 'default' : 
                              msg.status === 'sent' ? 'secondary' : 'destructive'}
                    >
                      {msg.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {msg.message}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                    <span>Scheduled: {new Date(msg.scheduled_time).toLocaleString()}</span>
                    <span className={new Date(msg.scheduled_time) <= new Date() ? 'text-orange-500' : ''}>
                      {new Date(msg.scheduled_time) <= new Date() ? 'Due now' : 'Pending'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={() => sendNow(msg.phone_number, msg.message, msg.id)}
                      size="sm"
                      className="flex-1"
                    >
                      <Send className="mr-1 h-3 w-3" />
                      Send Now
                    </Button>
                    <Button
                      onClick={() => deleteMessage(msg.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};