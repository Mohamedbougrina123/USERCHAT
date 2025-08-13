import { Server } from 'socket.io';

// تخزين بيانات الدردشة في الذاكرة (للاستخدام الحقيقي تحتاج لقاعدة بيانات)
let users = [];
let messages = [];
const ADMIN_PASSWORD = "bougrinamohamedadmin@#$123@#$"; // كلمة سر الأدمن

export default function SocketHandler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    const io = new Server(res.socket.server);
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log(`New user connected: ${socket.id}`);
      
      // إرسال البيانات الأولية
      socket.emit('init', {
        userId: socket.id,
        messages: messages
      });

      // تعيين اسم المستخدم
      socket.on('set_username', (username) => {
        const user = {
          id: socket.id,
          username: username,
          isAdmin: false,
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent']
        };
        
        users.push(user);
        io.emit('users_list', users);
        
        // إرسال إشعار دخول
        const notification = {
          type: 'notification',
          text: `${username} انضم إلى الدردشة`,
          timestamp: new Date().toISOString()
        };
        
        messages.push(notification);
        io.emit('new_message', notification);
      });

      // إرسال رسالة
      socket.on('send_message', (data) => {
        const user = users.find(u => u.id === socket.id);
        if (!user) return;
        
        const message = {
          userId: socket.id,
          username: user.username,
          text: data.text,
          image: data.image,
          timestamp: new Date().toISOString(),
          isAdmin: user.isAdmin
        };
        
        messages.push(message);
        io.emit('new_message', message);
      });

      // تسجيل دخول الأدمن
      socket.on('admin_login', ({ password }) => {
        const user = users.find(u => u.id === socket.id);
        if (!user) return;
        
        if (password === ADMIN_PASSWORD) {
          user.isAdmin = true;
          io.to(socket.id).emit('admin_auth', { success: true });
          
          const notification = {
            type: 'admin_message',
            text: `تم ترقية ${user.username} إلى أدمن`,
            timestamp: new Date().toISOString()
          };
          
          io.emit('new_message', notification);
        } else {
          io.to(socket.id).emit('admin_auth', { success: false });
        }
      });

      // أوامر الأدمن
      socket.on('admin_command', (command) => {
        const user = users.find(u => u.id === socket.id);
        if (!user || !user.isAdmin) return;
        
        let response;
        
        switch(command) {
          case '/ips':
            response = users.map(u => `${u.username}: ${u.ip}`).join('\n');
            break;
          case '/useragent':
            response = users.map(u => `${u.username}: ${u.userAgent}`).join('\n');
            break;
          case '/info':
            response = users.map(u => 
              `${u.username}\nIP: ${u.ip}\nBrowser: ${u.userAgent}`
            ).join('\n\n');
            break;
          default:
            response = 'أمر غير معروف';
        }
        
        const adminMessage = {
          type: 'admin_message',
          text: response,
          timestamp: new Date().toISOString()
        };
        
        io.to(socket.id).emit('new_message', adminMessage);
      });

      // عند الانفصال
      socket.on('disconnect', () => {
        const user = users.find(u => u.id === socket.id);
        if (user) {
          users = users.filter(u => u.id !== socket.id);
          io.emit('users_list', users);
          
          const notification = {
            type: 'notification',
            text: `${user.username} غادر الدردشة`,
            timestamp: new Date().toISOString()
          };
          
          messages.push(notification);
          io.emit('new_message', notification);
        }
      });
    });
  }
  res.end();
}
