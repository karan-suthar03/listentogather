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
  ChevronUp,
  Clock,
  Copy,
  Download,
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
  PlusCircle,
  Repeat,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  Users,
  UserX,
  Volume2,
  X,
  Youtube
} from 'lucide-angular';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {MusicPlayerComponent} from './music-player/music-player.component';
import {MusicDetailsComponent} from './music-details/music-details.component';
import {MainPanelComponent} from './main-panel/main-panel.component';
import {RoomDetailsComponent} from './room-details/room-details.component';
import {NotificationsComponent} from './notifications/notifications.component';
import {RoomComponent} from './room/room.component';

@NgModule({
  declarations: [
    AppComponent,
    MusicPlayerComponent,
    MusicDetailsComponent,
    MainPanelComponent,
    RoomDetailsComponent,
    NotificationsComponent, RoomComponent
  ], imports: [
    BrowserModule,
    CommonModule,
    RouterModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    LucideAngularModule.pick({
      SkipBack,
      Play,
      Pause,
      SkipForward,
      Volume2,
      Send,
      Users,
      Hash,
      Copy,
      Youtube,
      PlusCircle,
      UserX,
      LogOut,
      Music,
      ChevronUp,
      ChevronDown,
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
      ListMusic
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
