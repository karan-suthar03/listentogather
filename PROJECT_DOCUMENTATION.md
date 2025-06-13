# ListenTogether - Social Music Streaming Platform

## Project Overview

**ListenTogether** is a real-time collaborative music streaming platform that allows friends to create virtual rooms and listen to music together, synchronized across all participants. Think of it as a "watch party" but for music - everyone hears the same song at the same time, with shared controls and social features.

## Vision & Goals

### Primary Vision
Create a seamless social music experience where distance doesn't matter. Whether friends are in different cities or just different rooms, they can share the joy of discovering and enjoying music together in real-time.

### Core Goals
- **Synchronized Playback**: All users hear the exact same moment of a song simultaneously
- **Social Interaction**: Real-time chat, reactions, and collaborative playlist building
- **Seamless Experience**: Easy room creation/joining with simple codes
- **Multi-Platform**: Web-based for universal accessibility
- **Real-Time Updates**: Instant synchronization of all actions across all users

---

## Final Product Features

### 🏠 **Room Management**
- **Create Rooms**: Host creates a room and gets a shareable room code
- **Join Rooms**: Others join using the room code
- **Room Persistence**: Rooms stay active as long as participants are present
- **Host Controls**: Room creator has admin privileges (kick users, end room, etc.)
- **Participant Management**: See who's in the room, host vs. guest indicators

### 🎵 **Music Streaming & Synchronization**
- **YouTube Integration**: Stream music directly from YouTube
- **Synchronized Playback**: All users play/pause/seek together automatically
- **Queue Management**: Collaborative playlist where anyone can add songs
- **Host Priority**: Host can override controls when needed
- **Playback State Sync**: Play/pause/volume changes reflected instantly for everyone

### 💬 **Social Features**
- **Real-Time Chat**: Text chat within each room
- **Music Reactions**: Quick emoji reactions to songs
- **Now Playing Info**: Display current song info, progress, duration
- **User Activity**: See when users join/leave, add songs, or interact

### 🎛️ **User Controls**
- **Personal Volume**: Individual volume control (doesn't affect others)
- **Queue Contributions**: Add songs to the shared queue
- **Chat Participation**: Send/receive messages
- **Room Navigation**: Easy switching between rooms

### 📱 **Technical Features**
- **Real-Time Sync**: WebSocket-based instant updates
- **Cross-Platform**: Works on desktop, tablet, mobile browsers
- **Responsive Design**: Clean, modern UI that adapts to screen sizes
- **Connection Management**: Automatic reconnection, connection status indicators
- **Error Handling**: Graceful handling of network issues, invalid room codes, etc.

---

## User Experience Flow

### For Room Hosts:
1. Enter name and click "Create Room"
2. Share the generated room code with friends
3. Add initial songs to the queue
4. Control playback (play/pause/skip) for everyone
5. Manage participants and room settings
6. Chat and interact with guests

### For Room Guests:
1. Get room code from host
2. Enter name and room code to join
3. See current song and queue
4. Add songs to the shared queue
5. Chat with other participants
6. Enjoy synchronized music experience

---

## Technical Architecture

### Frontend (Angular)
- **Component-Based UI**: Modular components for room, player, chat, etc.
- **Real-Time Services**: WebSocket integration for live updates
- **State Management**: Reactive state handling for room/user data
- **Music Integration**: YouTube player embedding and control

### Backend (Node.js)
- **REST API**: Room creation, joining, user management
- **WebSocket Server**: Real-time synchronization and messaging
- **Room Management**: In-memory room state (expandable to database)
- **Music Coordination**: Centralized playback state management

### Key Technologies
- **Frontend**: Angular, TypeScript, Socket.IO Client, Bootstrap/CSS
- **Backend**: Node.js, Express, Socket.IO Server
- **Real-Time**: WebSockets for instant synchronization
- **Music**: YouTube API integration

---

## Current Status

### ✅ Completed Features
- Room creation and joining with codes
- Real-time participant management
- WebSocket-based live updates
- User interface foundation
- Basic error handling

### 🚧 In Development
- Music streaming integration
- Synchronized playback controls
- Queue management system
- Chat functionality

### 📋 Planned Features
- Advanced room settings
- Music reactions and voting
- Room persistence options
- Mobile optimization
- Audio quality controls

---

## Future Enhancements

### Short-Term
- **Music Discovery**: Integration with multiple streaming platforms
- **Advanced Queue**: Voting, reordering, queue history
- **Enhanced Chat**: Message reactions, user mentions
- **Room Customization**: Themes, room names, descriptions

### Long-Term
- **User Accounts**: Persistent profiles, friend lists, room history
- **Mobile App**: Native iOS/Android apps
- **Advanced Analytics**: Listening history, popular songs, room stats
- **Premium Features**: Higher quality audio, extended room duration
- **Integration**: Spotify, Apple Music, and other platform connections

---

## Target Audience

- **Friend Groups**: People who want to share music experiences remotely
- **Music Enthusiasts**: Users who enjoy discovering and discussing music together
- **Remote Communities**: Online groups, gaming communities, study groups
- **Long-Distance Relationships**: Couples and friends separated by distance
- **Event Organizers**: Virtual listening parties, music discovery sessions

---

## Success Metrics

- **User Engagement**: Time spent in rooms, return usage rates
- **Social Interaction**: Messages sent, songs added, reactions given
- **Technical Performance**: Synchronization accuracy, connection reliability
- **Growth**: Room creation rates, user acquisition, platform adoption

This project aims to bridge the gap between digital music consumption and social interaction, creating meaningful shared experiences in our increasingly connected yet physically distant world.