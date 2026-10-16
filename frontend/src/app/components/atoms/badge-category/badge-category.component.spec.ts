import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BadgeCategoryComponent } from './badge-category.component';

describe('BadgeCategoryComponent', () => {
  let fixture: ComponentFixture<BadgeCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeCategoryComponent],
    }).compileComponents();
  });

  it('renders the IT variant', () => {
    fixture = TestBed.createComponent(BadgeCategoryComponent);
    fixture.componentRef.setInput('category', 'IT');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.classList.contains('it')).toBe(true);
    expect(badge.textContent.trim()).toContain('IT');
  });

  it('renders the HR variant', () => {
    fixture = TestBed.createComponent(BadgeCategoryComponent);
    fixture.componentRef.setInput('category', 'HR');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.classList.contains('hr')).toBe(true);
    expect(badge.textContent.trim()).toContain('HR');
  });

  it('renders the Finance variant', () => {
    fixture = TestBed.createComponent(BadgeCategoryComponent);
    fixture.componentRef.setInput('category', 'Finance');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.classList.contains('finance')).toBe(true);
    expect(badge.textContent.trim()).toContain('Finance');
  });

  it('renders the General variant', () => {
    fixture = TestBed.createComponent(BadgeCategoryComponent);
    fixture.componentRef.setInput('category', 'General');
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge.classList.contains('general')).toBe(true);
    expect(badge.textContent.trim()).toContain('General');
  });
});
