import { useState, useEffect } from "react";
import { Calendar, Clock, Phone, MessageCircle, Send, Users, Edit, Trash2, Copy, RotateCcw, History, Paperclip, FileText, Image, Video, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface AttachedFile {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'video' | 'document';
  size: number;
}

interface ScheduledMessage {
  id: string;
  phoneNumber: string;
  message: string;
  scheduledDate: Date;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  attachments?: AttachedFile[];
}

export const MessageScheduler = () => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [message, setMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [messageHistory, setMessageHistory] = useState<ScheduledMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'compose' | 'scheduled' | 'history'>('compose');
  const [editingMessage, setEditingMessage] = useState<ScheduledMessage | null>(null);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedScheduledMessages = localStorage.getItem('scheduledMessages');
    const savedMessageHistory = localStorage.getItem('messageHistory');
    
    if (savedScheduledMessages) {
      try {
        const parsed = JSON.parse(savedScheduledMessages);
        const messagesWithDates = parsed.map((msg: any) => ({
          ...msg,
          scheduledDate: new Date(msg.scheduledDate),
          createdAt: new Date(msg.createdAt)
        }));
        setScheduledMessages(messagesWithDates);
      } catch (error) {
        console.error('Error loading scheduled messages:', error);
      }
    }
    
    if (savedMessageHistory) {
      try {
        const parsed = JSON.parse(savedMessageHistory);
        const historyWithDates = parsed.map((msg: any) => ({
          ...msg,
          scheduledDate: new Date(msg.scheduledDate),
          createdAt: new Date(msg.createdAt)
        }));
        setMessageHistory(historyWithDates);
      } catch (error) {
        console.error('Error loading message history:', error);
      }
    }
  }, []);

  // Save to localStorage whenever scheduledMessages changes
  useEffect(() => {
    localStorage.setItem('scheduledMessages', JSON.stringify(scheduledMessages));
  }, [scheduledMessages]);

  // Save to localStorage whenever messageHistory changes
  useEffect(() => {
    localStorage.setItem('messageHistory', JSON.stringify(messageHistory));
  }, [messageHistory]);

  // Check for scheduled messages every minute
  useEffect(() => {
    const checkScheduledMessages = () => {
      const now = new Date();
      scheduledMessages.forEach(msg => {
        if (msg.status === 'pending' && msg.scheduledDate <= now) {
          openWhatsAppMessage(msg);
        }
      });
    };

    const interval = setInterval(checkScheduledMessages, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [scheduledMessages]);

  const openWhatsAppMessage = (msg: ScheduledMessage) => {
    const phoneNumber = msg.phoneNumber.replace(/[^\d]/g, ''); // Remove non-digits
    const encodedMessage = encodeURIComponent(msg.message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Update message status
    setScheduledMessages(prev => 
      prev.map(m => m.id === msg.id ? { ...m, status: 'sent' as const } : m)
    );
    
    // Move to history
    setTimeout(() => {
      moveToHistory({ ...msg, status: 'sent' });
    }, 1000);
    
    // Open WhatsApp
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: "Message Ready!",
      description: `WhatsApp opened with your message to ${msg.phoneNumber}. Just tap Send!`,
    });
  };

  const handleScheduleMessage = () => {
    if (!phoneNumber || !message || !scheduledDate || !scheduledTime) return;

    const newMessage: ScheduledMessage = {
      id: editingMessage?.id || Date.now().toString(),
      phoneNumber,
      message,
      scheduledDate: new Date(`${scheduledDate}T${scheduledTime}`),
      status: 'pending',
      createdAt: editingMessage?.createdAt || new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined
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
    setAttachments([]);
  };

  const handleFileAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: AttachedFile[] = Array.from(files).map(file => {
      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('video/') ? 'video' : 'document';
      
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        path: URL.createObjectURL(file), // Temporary path for preview
        type: fileType,
        size: file.size
      };
    });

    setAttachments(prev => [...prev, ...newAttachments]);
    event.target.value = ''; // Reset input
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleEditMessage = (msg: ScheduledMessage) => {
    setEditingMessage(msg);
    setPhoneNumber(msg.phoneNumber);
    setMessage(msg.message);
    setScheduledDate(format(msg.scheduledDate, 'yyyy-MM-dd'));
    setScheduledTime(format(msg.scheduledDate, 'HH:mm'));
    setAttachments(msg.attachments || []);
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
              {!isHistory && msg.status === 'pending' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => openWhatsAppMessage(msg)}
                  className="text-whatsapp hover:text-whatsapp-dark"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">{msg.message}</p>
      
      {/* Attachments Display */}
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {msg.attachments.map((file) => (
            <div key={file.id} className="flex items-center gap-1 px-2 py-1 bg-muted/70 rounded text-xs">
              {getFileIcon(file.type)}
              <span className="truncate max-w-[100px]">{file.name}</span>
            </div>
          ))}
          {msg.attachments.length > 3 && (
            <div className="px-2 py-1 bg-muted/70 rounded text-xs">
              +{msg.attachments.length - 3} more
            </div>
          )}
        </div>
      )}
      
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
                    setAttachments([]);
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

              {/* Attachments Section */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-whatsapp" />
                  Attachments
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer">
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileAttachment}
                      className="hidden"
                      accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                    />
                    <Button variant="outline" className="w-full" type="button">
                      <Paperclip className="h-4 w-4 mr-2" />
                      Attach Files
                    </Button>
                  </label>
                </div>
                
                {/* Attached Files Display */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(file.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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