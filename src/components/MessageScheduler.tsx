import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Trash2, MessageSquare, Clock, Send, LogOut, ContactIcon, PlusIcon, History, X, Edit } from 'lucide-react';
import { Contacts } from '@capacitor-community/contacts';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Browser } from '@capacitor/browser';

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

interface EditingMessage {
  id: string;
  phone_number: string;
  message: string;
  scheduled_date: string;
  scheduled_time: string;
}

interface MessageSchedulerProps {
  onSignOut: () => void;
}

export const MessageScheduler = ({ onSignOut }: MessageSchedulerProps) => {
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [currentPhoneInput, setCurrentPhoneInput] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load scheduled and sent messages from Supabase
  const loadMessages = async () => {
    if (!user) return;
    
    try {
      const [scheduledResult, sentResult] = await Promise.all([
        supabase
          .from('scheduled_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('scheduled_time', { ascending: true }),
        supabase
          .from('scheduled_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'sent')
          .order('scheduled_time', { ascending: false })
      ]);

      if (scheduledResult.error) throw scheduledResult.error;
      if (sentResult.error) throw sentResult.error;
      
      setScheduledMessages((scheduledResult.data || []) as ScheduledMessage[]);
      setSentMessages((sentResult.data || []) as ScheduledMessage[]);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadMessages();
    setupNotifications();
  }, [user]);

  // Setup notifications and permissions
  const setupNotifications = async () => {
    try {
      const platform = Capacitor.getPlatform();
      const isNative = platform !== 'web';
      console.log('Setting up notifications, platform:', platform, 'isNative:', isNative);
      
      if (isNative) {
        // Request notification permissions for native
        const result = await LocalNotifications.requestPermissions();
        console.log('Notification permission result:', result);
        
        if (result.display !== 'granted') {
          toast({
            title: "Notifications Required",
            description: "Please enable notifications to receive message reminders",
            variant: "destructive",
          });
        }

        // Set up notification click handlers
        await LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
          console.log('Notification clicked:', notificationAction);
          const { notification } = notificationAction;
          if (notification.extra?.messageId) {
            // Find the message and open WhatsApp
            const messageData = notification.extra;
            await openWhatsApp(messageData.phoneNumber, messageData.message);
            await updateMessageStatus(messageData.messageId, 'sent');
            await loadMessages(); // Refresh the messages list
          }
        });
      } else {
        // For web, request browser notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          console.log('Browser notification permission:', permission);
        }
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  };

  // Schedule notification for message
  const scheduleNotification = async (messageId: string, phoneNumber: string, message: string, scheduledTime: Date) => {
    try {
      const platform = Capacitor.getPlatform();
      const isNative = platform !== 'web';
      console.log('Scheduling notification for:', scheduledTime, 'Platform:', platform, 'isNative:', isNative);
      
      if (isNative) {
        // Schedule native notification
        const notificationId = Math.floor(Math.random() * 1000000);
        await LocalNotifications.schedule({
          notifications: [
            {
              title: "WhatsApp Message Reminder",
              body: `Time to send message to ${phoneNumber}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
              id: notificationId,
              schedule: { at: scheduledTime },
              sound: 'default',
              extra: { messageId, phoneNumber, message },
              actionTypeId: 'SEND_MESSAGE',
              attachments: [],
              summaryArgument: ''
            }
          ]
        });
        console.log('Native notification scheduled with ID:', notificationId);
      } else {
        // For web/preview, schedule using setTimeout and also add to localStorage for persistence
        const timeUntilScheduled = scheduledTime.getTime() - Date.now();
        console.log('Time until scheduled (ms):', timeUntilScheduled);
        
        // Store in localStorage for persistence across page reloads
        const scheduledNotifications = JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
        scheduledNotifications.push({
          messageId,
          phoneNumber,
          message,
          scheduledTime: scheduledTime.getTime(),
          notificationId: Date.now()
        });
        localStorage.setItem('scheduledNotifications', JSON.stringify(scheduledNotifications));
        
        if (timeUntilScheduled > 0) {
          setTimeout(async () => {
            // Check if notification still exists (wasn't cancelled)
            const currentNotifications = JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
            const notificationExists = currentNotifications.find((n: any) => n.messageId === messageId);
            
            if (notificationExists) {
              if (Notification.permission === 'granted') {
                const notification = new Notification("WhatsApp Message Reminder", {
                  body: `Time to send message to ${phoneNumber}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
                  icon: '/favicon.ico',
                  tag: messageId
                });
                
                notification.onclick = () => {
                  window.focus();
                  openWhatsApp(phoneNumber, message);
                  updateMessageStatus(messageId, 'sent');
                  loadMessages(); // Refresh the messages list
                  notification.close();
                  
                  // Remove from localStorage
                  const updatedNotifications = currentNotifications.filter((n: any) => n.messageId !== messageId);
                  localStorage.setItem('scheduledNotifications', JSON.stringify(updatedNotifications));
                };
              } else {
                // Fallback: directly open WhatsApp if no notification permission
                await openWhatsApp(phoneNumber, message);
                await updateMessageStatus(messageId, 'sent');
                await loadMessages();
              }
            }
          }, timeUntilScheduled);
        }
      }
    } catch (error) {
      console.error('Error scheduling notification:', error);
      toast({
        title: "Warning",
        description: "Failed to schedule notification, but message was saved",
        variant: "destructive",
      });
    }
  };

  const selectContact = async () => {
    const platform = Capacitor.getPlatform();
    const isNative = platform !== 'web';
    console.log('Platform check:', platform, 'isNative:', isNative);
    
    if (!isNative) {
      toast({
        title: "Info",
        description: "Contact selection is only available on mobile devices",
      });
      return;
    }

    try {
      setContactsLoading(true);
      const result = await Contacts.pickContact({
        projection: {
          name: true,
          phones: true
        }
      });
      
      if (result.contact && (result.contact as any).phones && (result.contact as any).phones.length > 0) {
        const phoneNumber = (result.contact as any).phones[0].number?.replace(/\D/g, '') || '';
        setCurrentPhoneInput(phoneNumber);
        toast({
          title: "Success",
          description: "Contact selected successfully",
        });
      } else {
        toast({
          title: "Error",
          description: "Selected contact has no phone number",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error selecting contact:', error);
      toast({
        title: "Error",
        description: "Failed to select contact. Make sure you have granted contacts permission.",
        variant: "destructive",
      });
    } finally {
      setContactsLoading(false);
    }
  };

  const openWhatsApp = async (phoneNumber: string, message: string) => {
    const cleanPhoneNumber = phoneNumber.replace(/[^\d]/g, '');
    const encodedMessage = encodeURIComponent(message);
    const platform = Capacitor.getPlatform();
    const isNative = platform !== 'web';
    
    try {
      if (isNative) {
        // For native platforms, try to open WhatsApp app directly
        const whatsappUrl = `whatsapp://send?phone=${cleanPhoneNumber}&text=${encodedMessage}`;
        await Browser.open({ url: whatsappUrl });
      } else {
        // For web, use wa.me link
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

  const addPhoneNumber = () => {
    if (currentPhoneInput.trim() && !phoneNumbers.includes(currentPhoneInput.trim())) {
      setPhoneNumbers([...phoneNumbers, currentPhoneInput.trim()]);
      setCurrentPhoneInput('');
    }
  };

  const removePhoneNumber = (phoneToRemove: string) => {
    setPhoneNumbers(phoneNumbers.filter(phone => phone !== phoneToRemove));
  };

  const scheduleMessage = async () => {
    if (!message || !scheduledDateTime) {
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

    if (phoneNumbers.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one phone number",
        variant: "destructive",
      });
      return;
    }

    const scheduledTime = new Date(scheduledDateTime);
    
    if (scheduledTime <= new Date()) {
      toast({
        title: "Error",
        description: "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create messages for all phone numbers
      const messagesToInsert = phoneNumbers.map(phone => ({
        user_id: user.id,
        phone_number: phone,
        message,
        scheduled_time: scheduledTime.toISOString(),
        status: 'pending' as const
      }));

      const { data, error } = await supabase
        .from('scheduled_messages')
        .insert(messagesToInsert)
        .select();

      if (error) throw error;

      // Schedule notifications for all messages
      for (const messageData of data) {
        await scheduleNotification(messageData.id, messageData.phone_number, message, scheduledTime);
      }

      await loadMessages();

      // Clear form
      setPhoneNumbers([]);
      setCurrentPhoneInput('');
      setMessage('');
      setScheduledDateTime('');

      toast({
        title: "Success",
        description: `${phoneNumbers.length} message(s) scheduled successfully!`,
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

  const updateMessage = async () => {
    if (!editingMessage || !editingMessage.message || !editingMessage.scheduled_date || !editingMessage.scheduled_time) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const scheduledDateTime = new Date(`${editingMessage.scheduled_date}T${editingMessage.scheduled_time}`);
    
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
        .update({
          phone_number: editingMessage.phone_number,
          message: editingMessage.message,
          scheduled_time: scheduledDateTime.toISOString(),
        })
        .eq('id', editingMessage.id);

      if (error) throw error;

      // Re-schedule notification
      await scheduleNotification(editingMessage.id, editingMessage.phone_number, editingMessage.message, scheduledDateTime);

      await loadMessages();
      setEditingMessage(null);
      setIsEditDialogOpen(false);

      toast({
        title: "Success",
        description: "Message updated successfully!",
      });
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update message",
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

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Scheduled ({scheduledMessages.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History ({sentMessages.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Schedule New Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Numbers</Label>
                  <div className="flex gap-2">
                    <Input
                      id="phone"
                      placeholder="Enter phone number (+1234567890)"
                      value={currentPhoneInput}
                      onChange={(e) => setCurrentPhoneInput(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addPhoneNumber();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={selectContact}
                      disabled={contactsLoading}
                      className="px-3"
                    >
                      <ContactIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      onClick={addPhoneNumber}
                      disabled={!currentPhoneInput.trim()}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {phoneNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {phoneNumbers.map((phone, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {phone}
                          <button
                            onClick={() => removePhoneNumber(phone)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
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
                    <Label htmlFor="datetime">Schedule Date & Time</Label>
                    <Input
                      id="datetime"
                      type="datetime-local"
                      value={scheduledDateTime}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={scheduleMessage} 
                className="w-full"
                size="lg"
                disabled={loading || phoneNumbers.length === 0}
              >
                <Clock className="mr-2 h-5 w-5" />
                {loading ? 'Scheduling...' : `Schedule Message${phoneNumbers.length > 1 ? 's' : ''} (${phoneNumbers.length})`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled">
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
                  <p>No scheduled messages yet. Create your first one in the Schedule tab!</p>
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
                          variant="outline"
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Send Now
                        </Button>
                        <Button
                          onClick={() => {
                            const scheduledDateTime = new Date(msg.scheduled_time);
                            setEditingMessage({
                              id: msg.id,
                              phone_number: msg.phone_number,
                              message: msg.message,
                              scheduled_date: scheduledDateTime.toISOString().split('T')[0],
                              scheduled_time: scheduledDateTime.toTimeString().slice(0, 5)
                            });
                            setIsEditDialogOpen(true);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
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
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Message History ({sentMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sentMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sent messages yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sentMessages.map((msg) => (
                    <div key={msg.id} className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="font-medium">{msg.phone_number}</span>
                        <Badge variant="secondary">Sent</Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {msg.message}
                      </p>
                      
                      <p className="text-xs text-muted-foreground">
                        Sent: {new Date(msg.scheduled_time).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Message Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Message</DialogTitle>
          </DialogHeader>
          {editingMessage && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={editingMessage.phone_number}
                    onChange={(e) => setEditingMessage({...editingMessage, phone_number: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={`${editingMessage.scheduled_date}T${editingMessage.scheduled_time}`}
                    onChange={(e) => {
                      const [date, time] = e.target.value.split('T');
                      setEditingMessage({
                        ...editingMessage,
                        scheduled_date: date,
                        scheduled_time: time
                      });
                    }}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={editingMessage.message}
                  onChange={(e) => setEditingMessage({...editingMessage, message: e.target.value})}
                  className="min-h-[100px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setIsEditDialogOpen(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={updateMessage} disabled={loading}>
                  Update Message
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};