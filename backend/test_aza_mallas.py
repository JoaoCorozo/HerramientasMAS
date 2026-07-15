"""Pruebas de migración de mallas AZA."""

import pandas as pd

from aza_comparador import (
    analizar_cambios_fila,
    analizar_migracion_solo_plataforma,
    resolver_malla_plataforma,
)


def _fila(malla, nombre, rut="12345678-9"):
    return pd.Series(
        {
            "Rut": rut,
            "Nombres": "Juan",
            "Apellidos": "Pérez",
            "Correo": "juan@test.cl",
            "Empresa": "AZA",
            "Nombre de Malla": nombre,
            "Malla": malla,
            "Fecha de Ingreso": "",
            "Nombre del cargo": "",
            "Fecha Nacimiento": "",
            "Área Personal": "",
            "Nacionalidad": "",
            "División Superior Nombre": "",
            "División Nombre": "",
            "Área Superior Nombre": "",
            "Área Nombre": "",
            "Centro Costos Nombres": "",
            "Centro Costo Códigos": "",
            "Jefe Directo": "",
            "Rut Jefatura": "",
        }
    )


def test_ecoaza_malla_8_migra_a_6():
    res = resolver_malla_plataforma("8", "EcoAza")
    assert res.migrar is True
    assert res.malla_destino == "6"
    assert res.nombre_destino == "EcoAZA"


def test_aza_2024_migra_a_malla_1():
    res = resolver_malla_plataforma("2", "AZA 2024")
    assert res.migrar is True
    assert res.malla_destino == "1"
    assert res.nombre_destino == "AZA"


def test_malla_1_aza_vigente_no_es_eliminada():
    res = resolver_malla_plataforma("1", "AZA")
    assert res.eliminada is False
    assert res.migrar is False


def test_malla_eliminada_detectada():
    res = resolver_malla_plataforma("3", "AZA Comercial")
    assert res.eliminada is True
    assert res.migrar is False


def test_malla_1_aza_igual_no_genera_cambio_falso():
    row_cli = _fila("1", "AZA")
    row_plat = _fila("1", "AZA")
    cols, _, res = analizar_cambios_fila(row_cli, row_plat)
    assert res.eliminada is False
    assert "Malla" not in cols
    assert "Nombre de Malla" not in cols


def test_migracion_aparece_aunque_cliente_ya_este_actualizado():
    row_cli = _fila("1", "AZA")
    row_plat = _fila("2", "AZA 2024")
    cols, destino, res = analizar_cambios_fila(row_cli, row_plat)
    assert res.migrar is True
    assert "Malla" in cols
    assert destino["Malla"] == "1"
    assert destino["Nombre de Malla"] == "AZA"


def test_migracion_solo_plataforma():
    row_plat = _fila("4", "AZA Comercial 2024")
    resultado = analizar_migracion_solo_plataforma(row_plat)
    assert resultado is not None
    destino, _ = resultado
    assert destino["Malla"] == "2"
    assert destino["Nombre de Malla"] == "AZA Comercial"


def test_malla_7_aza_lideres_operacion_slash_migra_a_5():
    nombre_oficial = "Aza Lideres Operación / Ingenieros / Trainee"
    nombre = "AZA Líderes Operación/Ingenieros/Trainee"
    res = resolver_malla_plataforma("7", nombre)
    assert res.migrar is True
    assert res.malla_destino == "5"
    assert res.nombre_destino == nombre_oficial

    row_cli = _fila("5", nombre_oficial)
    row_plat = _fila("7", nombre)
    cols, destino, _ = analizar_cambios_fila(row_cli, row_plat)
    assert "Malla" in cols
    assert destino["Malla"] == "5"
    assert destino["Nombre de Malla"] == nombre_oficial
