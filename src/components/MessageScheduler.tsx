import { useState } from "react";
import { Calendar, Clock, Phone, MessageCircle, Send, Users, Edit, Trash2, Copy, RotateCcw, History } from "lucide-react";
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
  createdAt: Date;
}

export const MessageScheduler = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [messageHistory, setMessageHistory] = useState<ScheduledMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'compose' | 'scheduled' | 'history'>('compose');
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);

  const handleScheduleMessage = () => {
    if (!phoneNumber || !message || !scheduledDate || !scheduledTime) return;

    const newMessage: ScheduledMessage = {
      id: editingMessage?.id || Date.now().toString(),
      phoneNumber,
      message,
      scheduledDate: new Date(`${scheduledDate}T${scheduledTime}`),
      status: 'pending',
      createdAt: editingMessage?.createdAt || new Date()
    };

    if (editingMessage) {
      setScheduledMessages(prev => prev.map(msg => msg.id === editingMessage.id ? newMessage : msg));
      setEditingMessage(null);
    } else {
      setScheduledMessages([...scheduledMessages, newMessage]);
    }
    
    // Reset form
    setPhoneNumber("");
    setMessage("");
    setScheduledDate("");
    setScheduledTime("");
  };

  const handleEditMessage = (msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setPhoneNumber(msg.phoneNumber);
    setMessage(msg.message);
    setScheduledDate(format(msg.scheduledDate, 'yyyy-MM-dd'));
    setScheduledTime(format(msg.scheduledDate, 'HH:mm'));
    setActiveTab('compose');
  };

  const handleDeleteMessage = (id: string) => {
    setScheduledMessages(prev => prev.filter(msg => msg.id !== id));
  };

  const handleRecycleMessage = (msg: ScheduledMessage) => {
    setPhoneNumber(msg.phoneNumber);
    setMessage(msg.message);
    setActiveTab('compose');
  };

  const handleCopyMessage = (msg: ScheduledMessage) => {
    setMessage(msg.message);
    setActiveTab('compose');
  };

  const moveToHistory = (msg: ScheduledMessage) => {
    setMessageHistory(prev => [msg, ...prev]);
    setScheduledMessages(prev => prev.filter(m => m.id !== msg.id));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gradient-primary text-primary-foreground';
      case 'sent': return 'bg-whatsapp text-white';
      case 'failed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderMessageCard = (msg: ScheduledMessage, showActions = true, isHistory = false) => (
    <div key={msg.id} className="p-3 sm:p-4 border rounded-lg bg-gradient-card hover:shadow-message transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
        <div className="font-medium text-sm sm:text-base truncate">{msg.phoneNumber}</div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(msg.status)}>{msg.status}</Badge>
          {showActions && (
            <div className="flex gap-1">
              {!isHistory && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => handleEditMessage(msg)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteMessage(msg.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => handleRecycleMessage(msg)}>
                <RotateCcw className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleCopyMessage(msg)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">{msg.message}</p>
      <div className="text-xs text-muted-foreground">
        {format(msg.scheduledDate, "MMM dd, yyyy 'at' HH:mm")}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex overflow-x-auto no-scrollbar">
          <Button
            variant={activeTab === 'compose' ? 'default' : 'ghost'}
            className="flex-1 rounded-none border-0"
            onClick={() => setActiveTab('compose')}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Compose</span>
          </Button>
          <Button
            variant={activeTab === 'scheduled' ? 'default' : 'ghost'}
            className="flex-1 rounded-none border-0"
            onClick={() => setActiveTab('scheduled')}
          >
            <Clock className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Scheduled</span>
            {scheduledMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {scheduledMessages.length}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'ghost'}
            className="flex-1 rounded-none border-0"
            onClick={() => setActiveTab('history')}
          >
            <History className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">History</span>
            {messageHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {messageHistory.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-4 sm:space-y-6">
        {/* Compose Tab */}
        {activeTab === 'compose' && (
          <Card className="shadow-card animate-fade-in bg-gradient-card">
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <MessageCircle className="h-5 w-5 text-whatsapp" />
                {editingMessage ? 'Edit Message' : 'Compose Message'}
              </CardTitle>
              {editingMessage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingMessage(null);
                    setPhoneNumber("");
                    setMessage("");
                    setScheduledDate("");
                    setScheduledTime("");
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px] sm:min-h-[100px] resize-none"
                />
                <div className="text-right text-sm text-muted-foreground">
                  {message.length}/1000
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <Button 
                onClick={handleScheduleMessage}
                className="w-full bg-gradient-primary hover:bg-whatsapp-dark shadow-button"
                disabled={!phoneNumber || !message || !scheduledDate || !scheduledTime}
              >
                <Send className="h-4 w-4 mr-2" />
                {editingMessage ? 'Update Message' : 'Schedule Message'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Scheduled Messages Tab */}
        {activeTab === 'scheduled' && (
          <Card className="shadow-card animate-fade-in">
            <CardHeader>
              <CardTitle>Scheduled Messages ({scheduledMessages.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No scheduled messages yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledMessages.map((msg) => renderMessageCard(msg, true, false))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Card className="shadow-card animate-fade-in">
            <CardHeader>
              <CardTitle>Message History ({messageHistory.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {messageHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No message history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messageHistory.map((msg) => renderMessageCard(msg, true, true))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};