import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LucideAngularModule, SkipBack, Play, Pause, SkipForward, Volume2, Send, Users, Hash, Copy, Youtube, PlusCircle, UserX, LogOut, Music, ChevronUp, ChevronDown, X, Clock, Download, AlertCircle, CheckCircle } from 'lucide-angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MusicPlayerComponent } from './music-player/music-player.component';
import { MusicDetailsComponent } from './music-details/music-details.component';
import { MainPanelComponent } from './main-panel/main-panel.component';
import { RoomDetailsComponent } from './room-details/room-details.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { MusicQueueComponent } from './music-queue/music-queue.component';

@NgModule({
  declarations: [
    AppComponent,
    MusicPlayerComponent,
    MusicDetailsComponent,
    MainPanelComponent,
    RoomDetailsComponent,
    NotificationsComponent,
    MusicQueueComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    LucideAngularModule.pick({ SkipBack, Play, Pause, SkipForward, Volume2, Send, Users, Hash, Copy, Youtube, PlusCircle, UserX, LogOut, Music, ChevronUp, ChevronDown, X, Clock, Download, AlertCircle, CheckCircle })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
