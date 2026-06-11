import { Component } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';

export interface MarkAsRentedResult {
  lifetimeRent: boolean;
  rentPerMonth: number | null;
  contractExpiryDate: string | null;
}

@Component({
  selector: 'app-mark-as-rented-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Mark as Rented</h2>
    <mat-dialog-content>
      <div class="dialog-form">
        <mat-checkbox [(ngModel)]="lifetimeRent">Lifetime Rent</mat-checkbox>
        @if (!lifetimeRent) {
          <mat-form-field appearance="outline">
            <mat-label>Rent per Month (€)</mat-label>
            <input
              matInput
              type="number"
              min="0"
              [(ngModel)]="rentPerMonth"
              placeholder="e.g. 1200"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Contract Expiry Date</mat-label>
            <input matInput type="date" [(ngModel)]="contractExpiryDate" />
          </mat-form-field>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="confirm()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 300px;
        padding: 8px 0;
      }
      mat-form-field {
        width: 100%;
      }
    `,
  ],
})
export class MarkAsRentedDialogComponent {
  private readonly dialogRef = inject<
    MatDialogRef<MarkAsRentedDialogComponent, MarkAsRentedResult | null>
  >(MatDialogRef<MarkAsRentedDialogComponent>);

  lifetimeRent = false;
  rentPerMonth: number | null = null;
  contractExpiryDate: string | null = null;

  confirm(): void {
    this.dialogRef.close({
      lifetimeRent: this.lifetimeRent,
      rentPerMonth: this.lifetimeRent ? null : this.rentPerMonth,
      contractExpiryDate: this.lifetimeRent ? null : this.contractExpiryDate,
    });
  }
}
