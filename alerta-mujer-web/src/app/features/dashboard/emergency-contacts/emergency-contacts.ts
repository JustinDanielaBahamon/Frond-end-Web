import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { EmergencyContact } from '../../../core/models/emergency-contact.model';
import { AuthService } from '../../../core/auth/auth.service';
import { shrinkPhoto } from '../../../core/utils/foto';

const RELATIONSHIPS = ['Madre', 'Padre', 'Hermano/a', 'Pareja', 'Hijo/a', 'Amigo/a', 'Otro'];

type ContactForm = {
  nombre: string;
  telefono: string;
  email?: string;
  relationship: string;
  photo: string | null;
};

const EMPTY_FORM = (): ContactForm => ({
  nombre: '',
  telefono: '',
  email: '',
  relationship: '',
  photo: null,
});

@Component({
  selector: 'app-emergency-contacts',
  standalone: true,
  imports: [CommonModule, NgClass, FormsModule],
  templateUrl: './emergency-contacts.html',
  styleUrl: './emergency-contacts.scss',
})
export class EmergencyContacts implements OnInit {
  private contactService = inject(EmergencyContactService);
  private authService = inject(AuthService);
  // La app no usa zone.js: tras cada respuesta del servidor hay que avisar que cambió la vista
  private cdr = inject(ChangeDetectorRef);

  private userId = 0;

  loading = true;
  error = false;

  contacts: EmergencyContact[] = [];

  relationships = RELATIONSHIPS;

  menuOpen: number | null = null;

  addModalOpen = false;
  addForm: ContactForm = EMPTY_FORM();
  savingAdd = false;

  editModalOpen = false;
  editingContact: EmergencyContact | null = null;
  editForm: ContactForm = EMPTY_FORM();
  savingEdit = false;
  confirmingDelete = false;
  deleting = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) { this.error = true; this.loading = false; this.cdr.markForCheck(); return; }
      this.userId = user.id;
      this.loadContacts();
    });
  }

  private loadContacts() {
    this.loading = true;
    this.error = false;
    this.contactService.getByUser(this.userId).subscribe({
      next: (data) => {
        this.contacts = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.error = true; this.loading = false; this.cdr.markForCheck(); },
    });
  }

  initials(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('');
  }

  photoError = '';

  async choosePhoto(event: Event, form: ContactForm) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite volver a elegir la misma foto
    if (!file) return;
    this.photoError = '';
    try {
      form.photo = await shrinkPhoto(file);
    } catch (e) {
      this.photoError = e instanceof Error ? e.message : 'No se pudo usar la foto';
    }
    this.cdr.markForCheck();
  }

  removePhoto(form: ContactForm) {
    form.photo = null;
  }

  toggleMenu(id: number) {
    this.menuOpen = this.menuOpen === id ? null : id;
  }

  closeMenu() {
    this.menuOpen = null;
  }

  // --- Agregar ---

  openAddModal() {
    this.addForm = EMPTY_FORM();
    this.addModalOpen = true;
  }

  closeAddModal() {
    if (this.savingAdd) return;
    this.addModalOpen = false;
  }

  get addFormValid(): boolean {
    return !!this.addForm.nombre.trim()
      && !!this.addForm.telefono.trim()
      && !!this.addForm.relationship;
  }

  saveNewContact() {
    if (!this.addFormValid || this.savingAdd) return;

    this.savingAdd = true;
    const newOne: Omit<EmergencyContact, 'id'> = {
      userId: this.userId,
      nombre: this.addForm.nombre.trim(),
      telefono: this.addForm.telefono.trim(),
      email: this.addForm.email?.trim(),
      relationship: this.addForm.relationship,
      photo: this.addForm.photo,
    };

    this.contactService.create(newOne).subscribe({
      next: (created) => {
        this.contacts = [...this.contacts, created];
        this.savingAdd = false;
        this.addModalOpen = false;
        this.cdr.markForCheck();
      },
      error: () => { this.savingAdd = false; this.cdr.markForCheck(); },
    });
  }

  // --- Editar ---

  openEditModal(contacto: EmergencyContact) {
    this.closeMenu();
    this.editingContact = contacto;
    this.editForm = {
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      email: contacto.email,
      relationship: contacto.relationship,
      photo: contacto.photo ?? null,
    };
    this.confirmingDelete = false;
    this.editModalOpen = true;
  }

  closeEditModal() {
    if (this.savingEdit || this.deleting) return;
    this.editModalOpen = false;
    this.editingContact = null;
    this.confirmingDelete = false;
  }

  get editFormValid(): boolean {
    return !!this.editForm.nombre.trim()
      && !!this.editForm.telefono.trim()
      && !!this.editForm.relationship;
  }

  saveChanges() {
    if (!this.editingContact || !this.editFormValid || this.savingEdit) return;

    this.savingEdit = true;
    const id = this.editingContact.id;
    const changes: Partial<EmergencyContact> = {
      nombre: this.editForm.nombre.trim(),
      telefono: this.editForm.telefono.trim(),
      email: this.editForm.email?.trim(),
      relationship: this.editForm.relationship,
      photo: this.editForm.photo,
    };

    this.contactService.update(id, changes).subscribe({
      next: (updated) => {
        this.contacts = this.contacts
          .map(c => (c.id === id ? updated : c));
        this.savingEdit = false;
        this.editModalOpen = false;
        this.editingContact = null;
        this.cdr.markForCheck();
      },
      error: () => { this.savingEdit = false; this.cdr.markForCheck(); },
    });
  }

  askDeleteConfirmation() {
    this.confirmingDelete = true;
  }

  cancelDelete() {
    this.confirmingDelete = false;
  }

  confirmDelete() {
    if (!this.editingContact || this.deleting) return;

    this.deleting = true;
    const id = this.editingContact.id;

    this.contactService.delete(id).subscribe({
      next: () => {
        this.contacts = this.contacts.filter(c => c.id !== id);
        this.deleting = false;
        this.editModalOpen = false;
        this.editingContact = null;
        this.confirmingDelete = false;
        this.cdr.markForCheck();
      },
      error: () => { this.deleting = false; this.cdr.markForCheck(); },
    });
  }

  // --- Acciones rápidas desde el menú ---

  deleteFromMenu(contacto: EmergencyContact) {
    this.openEditModal(contacto);
    this.askDeleteConfirmation();
  }
}