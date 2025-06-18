import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {RouterModule} from '@angular/router';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Frown,
  Hash,
  ListMusic,
  LogIn,
  LogOut,
  LucideAngularModule,
  Maximize,
  MessageCircle,
  Music,
  Pause,
  Play,
  Plus,
  PlusCircle,
  Repeat,
  Search,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  User,
  Users,
  UserX,
  Volume2,
  X,
  Youtube
} from 'lucide-angular';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {MusicPlayerComponent} from './music-player/music-player.component';
import {RoomDetailsComponent} from './room-details/room-details.component';
import {NotificationsComponent} from './notifications/notifications.component';
import {RoomComponent} from './room/room.component';
import {LandingComponent} from './landing/landing.component';
import {JoinRoomComponent} from './join-room/join-room.component';
import {NavigationComponent} from './navigation/navigation.component';
import {QueueComponent} from './queue/queue.component';
import {MusicSearchComponent} from './music-search/music-search.component';

@NgModule({
  declarations: [
    AppComponent,
    MusicPlayerComponent,
    RoomDetailsComponent,
    NotificationsComponent,
    RoomComponent,
    LandingComponent,
    JoinRoomComponent,
    NavigationComponent,
    QueueComponent,
    MusicSearchComponent
  ], imports: [
    BrowserModule,
    CommonModule,
    RouterModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule, LucideAngularModule.pick({
      SkipBack,
      Play,
      Pause,
      SkipForward,
      Volume2, Send,
      Users,
      User,
      Hash,
      Copy,
      Youtube,
      PlusCircle,
      UserX,
      LogOut, Music,
      ChevronUp,
      ChevronDown,
      ChevronLeft,
      X,
      Clock,
      Download,
      AlertCircle,
      CheckCircle,
      LogIn,
      MessageCircle,
      Shuffle,
      Repeat,
      Maximize,
      ListMusic,
      Search,
      Plus,
      Frown
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
