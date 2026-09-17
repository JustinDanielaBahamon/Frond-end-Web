import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { ContactoEmergencia } from '../../../core/models/emergency-contact.model';
import { AuthService } from '../../../core/auth/auth.service';

const RELACIONES = ['Madre', 'Padre', 'Hermano/a', 'Pareja', 'Hijo/a', 'Amigo/a', 'Otro'];

const PRIORIDADES = [
  { value: 1, label: '1 - Más importante' },
  { value: 2, label: '2 - Importante' },
  { value: 3, label: '3 - Media' },
  { value: 4, label: '4 - Baja' },
  { value: 5, label: '5 - Menos importante' },
];

type ContactoForm = {
  nombre: string;
  telefono: string;
  relacion: string;
  prioridad: number;
  activo: boolean;
};

const FORM_VACIO = (): ContactoForm => ({
  nombre: '',
  telefono: '',
  relacion: '',
  prioridad: 1,
  activo: true,
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

  private usuarioId = 0;

  loading = true;
  error = false;

  contactos: ContactoEmergencia[] = [];

  relaciones = RELACIONES;
  prioridades = PRIORIDADES;

  menuAbierto: number | null = null;

  modalAgregarAbierto = false;
  formAgregar: ContactoForm = FORM_VACIO();
  guardandoAgregar = false;

  modalEditarAbierto = false;
  contactoEditando: ContactoEmergencia | null = null;
  formEditar: ContactoForm = FORM_VACIO();
  guardandoEditar = false;
  confirmandoEliminar = false;
  eliminando = false;

  ngOnInit() {
    this.authService.currentUser$.subscribe((usuario: any) => {
      if (!usuario) { this.error = true; this.loading = false; return; }
      this.usuarioId = usuario.id ?? usuario.usuarioId ?? 1;
      this.cargarContactos();
    });
  }

  private cargarContactos() {
    this.loading = true;
    this.error = false;
    this.contactService.getByUsuario(this.usuarioId).subscribe({
      next: (data) => {
        this.contactos = data.sort((a, b) => a.prioridad - b.prioridad);
        this.loading = false;
      },
      error: () => { this.error = true; this.loading = false; },
    });
  }

  iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0]?.toUpperCase())
      .join('');
  }

  toggleMenu(id: number) {
    this.menuAbierto = this.menuAbierto === id ? null : id;
  }

  cerrarMenu() {
    this.menuAbierto = null;
  }

  // --- Agregar ---

  abrirModalAgregar() {
    this.formAgregar = FORM_VACIO();
    this.modalAgregarAbierto = true;
  }

  cerrarModalAgregar() {
    if (this.guardandoAgregar) return;
    this.modalAgregarAbierto = false;
  }

  get formAgregarValido(): boolean {
    return !!this.formAgregar.nombre.trim()
      && !!this.formAgregar.telefono.trim()
      && !!this.formAgregar.relacion;
  }

  guardarNuevoContacto() {
    if (!this.formAgregarValido || this.guardandoAgregar) return;

    this.guardandoAgregar = true;
    const nuevo: Omit<ContactoEmergencia, 'id'> = {
      usuarioId: this.usuarioId,
      nombre: this.formAgregar.nombre.trim(),
      telefono: this.formAgregar.telefono.trim(),
      relacion: this.formAgregar.relacion,
      prioridad: this.formAgregar.prioridad,
      activo: this.formAgregar.activo,
    };

    this.contactService.create(nuevo).subscribe({
      next: (creado) => {
        this.contactos = [...this.contactos, creado].sort((a, b) => a.prioridad - b.prioridad);
        this.guardandoAgregar = false;
        this.modalAgregarAbierto = false;
      },
      error: () => { this.guardandoAgregar = false; },
    });
  }

  // --- Editar ---

  abrirModalEditar(contacto: ContactoEmergencia) {
    this.cerrarMenu();
    this.contactoEditando = contacto;
    this.formEditar = {
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      relacion: contacto.relacion,
      prioridad: contacto.prioridad,
      activo: contacto.activo,
    };
    this.confirmandoEliminar = false;
    this.modalEditarAbierto = true;
  }

  cerrarModalEditar() {
    if (this.guardandoEditar || this.eliminando) return;
    this.modalEditarAbierto = false;
    this.contactoEditando = null;
    this.confirmandoEliminar = false;
  }

  get formEditarValido(): boolean {
    return !!this.formEditar.nombre.trim()
      && !!this.formEditar.telefono.trim()
      && !!this.formEditar.relacion;
  }

  guardarCambios() {
    if (!this.contactoEditando || !this.formEditarValido || this.guardandoEditar) return;

    this.guardandoEditar = true;
    const id = this.contactoEditando.id;
    const cambios: Partial<ContactoEmergencia> = {
      nombre: this.formEditar.nombre.trim(),
      telefono: this.formEditar.telefono.trim(),
      relacion: this.formEditar.relacion,
      prioridad: this.formEditar.prioridad,
      activo: this.formEditar.activo,
    };

    this.contactService.update(id, cambios).subscribe({
      next: (actualizado) => {
        this.contactos = this.contactos
          .map(c => (c.id === id ? actualizado : c))
          .sort((a, b) => a.prioridad - b.prioridad);
        this.guardandoEditar = false;
        this.modalEditarAbierto = false;
        this.contactoEditando = null;
      },
      error: () => { this.guardandoEditar = false; },
    });
  }

  pedirConfirmacionEliminar() {
    this.confirmandoEliminar = true;
  }

  cancelarEliminar() {
    this.confirmandoEliminar = false;
  }

  confirmarEliminar() {
    if (!this.contactoEditando || this.eliminando) return;

    this.eliminando = true;
    const id = this.contactoEditando.id;

    this.contactService.delete(id).subscribe({
      next: () => {
        this.contactos = this.contactos.filter(c => c.id !== id);
        this.eliminando = false;
        this.modalEditarAbierto = false;
        this.contactoEditando = null;
        this.confirmandoEliminar = false;
      },
      error: () => { this.eliminando = false; },
    });
  }

  // --- Acciones rápidas desde el menú ---

  toggleActivo(contacto: ContactoEmergencia) {
    this.cerrarMenu();
    this.contactService.update(contacto.id, { activo: !contacto.activo }).subscribe({
      next: (actualizado) => {
        this.contactos = this.contactos.map(c => (c.id === contacto.id ? actualizado : c));
      },
    });
  }

  eliminarDesdeMenu(contacto: ContactoEmergencia) {
    this.abrirModalEditar(contacto);
    this.pedirConfirmacionEliminar();
  }
}