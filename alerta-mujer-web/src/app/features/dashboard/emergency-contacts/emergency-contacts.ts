import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyContactService } from '../../../core/services/emergency-contact.service';
import { ContactoEmergencia } from '../../../core/models/emergency-contact.model';
import { AuthService } from '../../../core/auth/auth.service';
import { reducirFoto } from '../../../core/utils/foto';

const RELACIONES = ['Madre', 'Padre', 'Hermano/a', 'Pareja', 'Hijo/a', 'Amigo/a', 'Otro'];

type ContactoForm = {
  nombre: string;
  telefono: string;
  email?: string;
  relacion: string;
  foto: string | null;
};

const FORM_VACIO = (): ContactoForm => ({
  nombre: '',
  telefono: '',
  email: '',
  relacion: '',
  foto: null,
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

  private usuarioId = 0;

  loading = true;
  error = false;

  contactos: ContactoEmergencia[] = [];

  relaciones = RELACIONES;

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
      if (!usuario) { this.error = true; this.loading = false; this.cdr.markForCheck(); return; }
      this.usuarioId = usuario.id;
      this.cargarContactos();
    });
  }

  private cargarContactos() {
    this.loading = true;
    this.error = false;
    this.contactService.getByUsuario(this.usuarioId).subscribe({
      next: (data) => {
        this.contactos = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.error = true; this.loading = false; this.cdr.markForCheck(); },
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

  errorFoto = '';

  async elegirFoto(evento: Event, form: ContactoForm) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // permite volver a elegir la misma foto
    if (!archivo) return;
    this.errorFoto = '';
    try {
      form.foto = await reducirFoto(archivo);
    } catch (e) {
      this.errorFoto = e instanceof Error ? e.message : 'No se pudo usar la foto';
    }
    this.cdr.markForCheck();
  }

  quitarFoto(form: ContactoForm) {
    form.foto = null;
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
      email: this.formAgregar.email?.trim(),
      relacion: this.formAgregar.relacion,
      foto: this.formAgregar.foto,
    };

    this.contactService.create(nuevo).subscribe({
      next: (creado) => {
        this.contactos = [...this.contactos, creado];
        this.guardandoAgregar = false;
        this.modalAgregarAbierto = false;
        this.cdr.markForCheck();
      },
      error: () => { this.guardandoAgregar = false; this.cdr.markForCheck(); },
    });
  }

  // --- Editar ---

  abrirModalEditar(contacto: ContactoEmergencia) {
    this.cerrarMenu();
    this.contactoEditando = contacto;
    this.formEditar = {
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      email: contacto.email,
      relacion: contacto.relacion,
      foto: contacto.foto ?? null,
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
      email: this.formEditar.email?.trim(),
      relacion: this.formEditar.relacion,
      foto: this.formEditar.foto,
    };

    this.contactService.update(id, cambios).subscribe({
      next: (actualizado) => {
        this.contactos = this.contactos
          .map(c => (c.id === id ? actualizado : c));
        this.guardandoEditar = false;
        this.modalEditarAbierto = false;
        this.contactoEditando = null;
        this.cdr.markForCheck();
      },
      error: () => { this.guardandoEditar = false; this.cdr.markForCheck(); },
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
        this.cdr.markForCheck();
      },
      error: () => { this.eliminando = false; this.cdr.markForCheck(); },
    });
  }

  // --- Acciones rápidas desde el menú ---

  eliminarDesdeMenu(contacto: ContactoEmergencia) {
    this.abrirModalEditar(contacto);
    this.pedirConfirmacionEliminar();
  }
}