import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiCardComponent } from './kpi-card.component';

describe('KpiCardComponent', () => {
  let fixture: ComponentFixture<KpiCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [KpiCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(KpiCardComponent);
  });

  it('renders label and value', () => {
    fixture.componentRef.setInput('label', 'Open Tasks');
    fixture.componentRef.setInput('value', 42);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.kpi-value')?.textContent).toContain('42');
    expect(el.querySelector('.kpi-label')?.textContent).toContain('Open Tasks');
  });
});
