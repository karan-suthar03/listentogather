import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, SkipBack, Play, SkipForward, Volume2, Send, Users, Hash, Copy, Youtube, PlusCircle, UserX, LogOut } from 'lucide-angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MusicPlayerComponent } from './music-player/music-player.component';
import { MusicDetailsComponent } from './music-details/music-details.component';
import { MainPanelComponent } from './main-panel/main-panel.component';
import { RoomDetailsComponent } from './room-details/room-details.component';

@NgModule({
  declarations: [
    AppComponent,
    MusicPlayerComponent,
    MusicDetailsComponent,
    MainPanelComponent,
    RoomDetailsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    LucideAngularModule.pick({ SkipBack, Play, SkipForward, Volume2, Send, Users, Hash, Copy, Youtube, PlusCircle, UserX, LogOut })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
