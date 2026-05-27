import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { form, required, min, FormField } from '@angular/forms/signals';

interface DialogData {
  neighborhoods: Record<string, string[]>;
}

interface ListingData {
  name: string;
  city: string;
  neighborhood: string;
  price: number;
  sizeM2: number;
  isRented: boolean;
  currentRentPrice: number;
}

@Component({
  selector: 'app-create-manual-listing',
  templateUrl: './create-manual-listing.html',
  styleUrl: './create-manual-listing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    FormField,
  ],
})
export class CreateManualListing {
  private readonly dialogRef = inject(MatDialogRef<CreateManualListing>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  readonly submitAttempted = signal(false);
  readonly cities = Object.keys(this.data.neighborhoods);

  readonly listingModel = signal<ListingData>({
    name: '',
    city: '',
    neighborhood: '',
    price: 0,
    sizeM2: 0,
    isRented: false,
    currentRentPrice: 0,
  });

  readonly listingForm = form(this.listingModel, (s) => {
    required(s.name, { message: 'Listing name is required' });
    required(s.city, { message: 'City is required' });
    required(s.neighborhood, { message: 'Neighborhood is required' });
    required(s.price, { message: 'Price is required' });
    min(s.price, 1, { message: 'Price must be greater than 0' });
    required(s.sizeM2, { message: 'Size is required' });
    min(s.sizeM2, 1, { message: 'Size must be greater than 0' });
  });

  readonly isRented = computed(() => this.listingModel().isRented);
  readonly isCitySelected = computed(() => !!this.listingModel().city);

  readonly availableNeighborhoods = computed(() => {
    const city = this.listingModel().city;
    return city ? (this.data.neighborhoods[city] ?? []) : [];
  });

  onCityChange(city: string) {
    const currentNeighborhood = this.listingModel().neighborhood;
    const validNeighborhoods = this.data.neighborhoods[city] ?? [];

    this.listingForm.city().value.set(city);

    if (!validNeighborhoods.includes(currentNeighborhood)) {
      this.listingForm.neighborhood().value.set('');
    }
  }

  showError(field: {
    touched: () => boolean;
    dirty: () => boolean;
    errors: () => Array<{ message?: string }>;
  }) {
    return (
      field.errors().length > 0 && (field.touched() || field.dirty() || this.submitAttempted())
    );
  }

  getErrorMessage(field: { errors: () => Array<{ message?: string }> }) {
    return field.errors()[0]?.message ?? '';
  }

  close() {
    this.dialogRef.close();
  }

  submit() {
    this.submitAttempted.set(true);

    if (this.listingForm().invalid()) {
      return;
    }

    const data = this.listingModel();

    this.dialogRef.close({
      ...data,
      currentRentPrice: data.isRented ? data.currentRentPrice : null,
    });
  }
}
