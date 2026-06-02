from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    hashed_password = Column(String(255))
    role = Column(String(20), default="user")
    permissions_json = Column(String(2000), default="[]")


class AppData(Base):
    __tablename__ = "app_data"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), index=True)
    module_name = Column(String(50), index=True)
    payload_json = Column(String)


class MoodleCourse(Base):
    """Catálogo Moodle (id + shortname) importado desde cursos bex Moodle."""

    __tablename__ = "moodle_courses"

    id = Column(Integer, primary_key=True, index=True)
    moodle_id = Column(Integer, unique=True, index=True, nullable=False)
    shortname = Column(String(500), nullable=False)
    fullname = Column(String(1000), default="")
    visible = Column(Integer, default=1)


class InductionProfile(Base):
    """Perfil de inducción (antes una hoja del Excel)."""

    __tablename__ = "induction_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False)
    name_key = Column(String(200), unique=True, index=True, nullable=False)

    course_links = relationship(
        "ProfileCourse",
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="ProfileCourse.sort_order",
    )


class ProfileCourse(Base):
    __tablename__ = "profile_courses"
    __table_args__ = (UniqueConstraint("profile_id", "course_id", name="uq_profile_course"),)

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("induction_profiles.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(Integer, ForeignKey("moodle_courses.id", ondelete="CASCADE"), nullable=False)
    sort_order = Column(Integer, default=0)

    profile = relationship("InductionProfile", back_populates="course_links")
    course = relationship("MoodleCourse")
