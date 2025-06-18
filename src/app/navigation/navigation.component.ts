import {Component, EventEmitter, HostListener, Input, OnInit, Output} from '@angular/core';

export type DesktopTab = 'search' | 'room';
export type MobileTab = 'search' | 'queue' | 'room';

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css']
})
export class NavigationComponent implements OnInit {
  @Input() activeTab: DesktopTab | MobileTab = 'search';
  @Input() queueCount: number = 0;
  @Input() isMobile: boolean = false;
  @Output() tabChange = new EventEmitter<DesktopTab | MobileTab>();

  ngOnInit() {
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
  }

  onTabChange(tab: DesktopTab | MobileTab) {
    this.tabChange.emit(tab);
  }
}
